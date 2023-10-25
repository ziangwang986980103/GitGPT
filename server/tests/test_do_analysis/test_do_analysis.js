import fs from "fs";
import { Octokit } from "@octokit/rest";
import { process } from '../../env.js';
import prompt_summarize from '../../Prompts/gpt_summarize.js';
import OpenAI, { NotFoundError } from 'openai';
const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API
});
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"


async function chunkify_text(text, chunkSize) {
    let startTime = performance.now();
    // create the chunks based only on fixed size
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    let endTime = performance.now();
    console.log(`The size of the text is ${text.length} characters. The time of chunkify is ${(endTime - startTime)/1000} seconds`);
    return chunks;

    //split based on the character '/n'
    // const splitter = new RecursiveCharacterTextSplitter({
    //      //Set custom chunk size
    //     chunk_size:chunkSize,
    //     chunk_overlap:200,
    //     //Use length of the text as the size measure
    //     length_function: s => s.length,
    //     //Use only "\n\n" as the separator
    //     separators:['\n','\n\n','}',',',';','.']
    // });

    // const output = await splitter.createDocuments([text]);
    // const parsedOutput = output.map((value,i)=>(value.pageContent));
    // let endTime = performance.now();
    // console.log(`The size of the text is ${text.length} characters. The time of chunkify is ${(endTime - startTime)/1000} seconds`);
    // return parsedOutput;
}
/**
 * 
 * @param {string} text - the text to be summarized
 * 
 * 
 * split the text into chunks and summarize them, and them summarize the summaries recursively. use fixed chunk size 3000 characters here. and the output size will be 5x compressed here
 */
async function do_summary(text) {
    let startTime = performance.now();
    let messages = [
        { role: "system", content: prompt_summarize },
        { role: "user", content: 'Here is the content:' }
    ];
    const jsonData = {
        model: "gpt-3.5-turbo-16k",
        messages: messages
    };
    if (text.length <= 3000) {
        try {
            //just summarize the actual text
            messages[messages.length - 1].content += text;
            // jsonData.max_tokens = Math.max(1, Math.ceil(text.length *2));
            const completion = await openai.chat.completions.create(jsonData);
            return completion.choices[0].message.content;
        }
        catch (error) {
            console.error(`error in do_summary ${error || error.status}`);
        }
    }
    try {

        const chunks = await chunkify_text(text, 3000);
        const promises = chunks.map(async (value, i) => {
            return await do_summary(value);
        });
        const results = await Promise.allSettled(promises);
        let successResults = results.filter((value, i) => { return value.status === "fulfilled" }).map((v, i) => { return JSON.stringify(v.value) });
        const concatenated = successResults.join();
        const summary = await do_summary(concatenated);
        let endTime = performance.now();
        console.log(`The text size is ${text.length} characters. The time of summary is ${(endTime - startTime)/1000} seconds`);
        return summary;
        //concatenated the previous summary to the current one
        // const chunks = await chunkify_text(text, 3000);
        // let summary = "";
        // // const summaries = [];

        // for (let i = 0; i < chunks.length; i++) {
        //     const currentText = summary + chunks[i];
        //     summary = await do_summary(currentText);
        //     // summaries.push(summary);
        //     // concatenatedSummaries += summary;
        // }
        // return summary;
    }
    catch (error) {
        console.error(`error in do_summary ${error || error.status}`);
    }
}


/**
 * This function will recursive analyze the sub-directories/files of the current path, and then summarize them to get the analysis of the current path.
 * @returns {object} repo_analysis -a object containing the analysis of the current repo in the form {path:string, type: string(dir,file), analysis: string, children:[array of the sub-directories/files analysis object]}. The children will be empty if it's a file
 */
async function do_analysis(repoLink, owner, repo) {
    let repository = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: owner,
        repo: repo,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    })

    let result = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
        owner: owner,
        repo: repo,
        tree_sha: repository.data.default_branch,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    })
    //the paths to and type of the root's directories and files
    let paths = result.data.tree.map((value, index) => ({ path: value.path, type: value.type }));
    let promises = paths.map(async item => {
        return await recursive_analysis(item, owner, repo);
    });

    //summarize the analysis
    let results = await Promise.allSettled(promises);
    let concatenated = "";
    let parseResults = results.map((item, i) => {
        concatenated += JSON.stringify({
            path: item.value.path,
            type: item.value.type,
            summary: (item.status === "fulfilled") ? item.value.summary : ""
        }) + ",\n";
        return item.value;  // or whatever transformation you want to apply
    });
    // console.log("children: ",children);
    console.log("concatenated in do_analysis: ",concatenated);
    let summary = await do_summary(concatenated);
    return {
        path: repoLink,
        type: "dir",
        summary: summary,
        children: parseResults
    };
}

/**
 * 
 * @param {object} item - {path:string,type:string}
 */
async function recursive_analysis(item, owner, repo) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: owner,
        repo: repo,
        path: item.path,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (item.type === "blob" || item.type === "file") {

        //summarize the file's content
        const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
        // const content = return await file_analysis(item.path, decodedContent);
        //TODO: add the name of the file to it as context
        const summary = await do_summary(decodedContent);
        return {
            path: item.path,
            type: "file",
            summary: summary
        }
    }
    else {
        const promises = response.data.map(async (value, i) => {
            return await recursive_analysis({ path: value.path, type: value.type }, owner, repo);
        });
        const results = await Promise.allSettled(promises);
        let concatenated = "";
        let parseResults = results.map((item, i) => {
            concatenated += JSON.stringify({
                path: item.value.path,
                type: item.value.type,
                summary: (item.status === "fulfilled") ? item.value.summary : ""
            }) + ",\n";
            return item.value;  // or whatever transformation you want to apply
        });
        // console.log("parsedResults:",parseResults);
        console.log("concatenated:",concatenated);
        
        let summary = await do_summary(concatenated);
        return {
            path: item.path,
            type: "dir",
            summary: summary,
            children: parseResults
        };
    }
}


try {
    const beginTime = performance.now();
    const repo_analysis = await do_analysis("https://github.com/Felx-B/vscode-web", "Felx-B", "vscode-web");
    const endTime = performance.now();
    console.log(repo_analysis);
    console.log("successfully do the repo_analysis");
    console.log(`The analysis of the repo takes ${(endTime - beginTime) / 1000} seconds`);
    fs.writeFileSync('output.txt', JSON.stringify(repo_analysis, null, 2), 'utf8');
} catch (error) {
    console.error(`error in do_analysis in retrieve_code: ${error || error.status}`);
}
