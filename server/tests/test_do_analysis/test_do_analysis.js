import dotenv from 'dotenv';
dotenv.config();
import fs from "fs";
import { Octokit } from "@octokit/rest";
// import { process } from '../../env.js';
import prompt_summarize from '../../Prompts/gpt_summarize.js';
import OpenAI, { NotFoundError } from 'openai';
const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API
});
import file_to_be_ignored from "../../Prompts/ignore.js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"


// function chunkify_text(text, chunkSize) {
//     let startTime = performance.now();
//     // create the chunks based only on fixed size
//     const chunks = [];
//     for (let i = 0; i < text.length; i += chunkSize) {
//         chunks.push(text.slice(i, i + chunkSize));
//     }
//     let endTime = performance.now();
//     // console.log(`The size of the text is ${text.length} characters. The time of chunkify is ${(endTime - startTime) / 1000} seconds`);
//     return chunks;

//     //split based on the character '/n'
//     // const splitter = new RecursiveCharacterTextSplitter({
//     //      //Set custom chunk size
//     //     chunk_size:chunkSize,
//     //     chunk_overlap:200,
//     //     //Use length of the text as the size measure
//     //     length_function: s => s.length,
//     //     //Use only "\n\n" as the separator
//     //     separators:['\n','\n\n','}',',',';','.']
//     // });

//     // const output = await splitter.createDocuments([text]);
//     // const parsedOutput = output.map((value,i)=>(value.pageContent));
//     // let endTime = performance.now();
//     // console.log(`The size of the text is ${text.length} characters. The time of chunkify is ${(endTime - startTime)/1000} seconds`);
//     // return parsedOutput;
// }

// function delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// /**
//  * 
//  * @param {string} text - the text to be summarized
//  * 
//  * 
//  * split the text into chunks and summarize them, and them summarize the summaries recursively. use fixed chunk size 3000 characters here. and the output size will be 5x compressed here
//  */
// async function do_summary(text) {
//     let startTime = performance.now();
//     let messages = [
//         { role: "system", content: prompt_summarize },
//         { role: "user", content: 'Here is the content: ' }
//     ];
//     const jsonData = {
//         model: "gpt-3.5-turbo-16k",
//         messages: messages
//     };
//     if (text.length <= 30000) {
//         try {
//             //just summarize the actual text
//             messages[messages.length - 1].content += text;
//             // jsonData.max_tokens = Math.max(1, Math.ceil(text.length *2));
//             const completion = await openai.chat.completions.create(jsonData);
//             return completion.choices[0].message.content;
//         }
//         catch (error) {
//             if (error.message.includes("429")) {
//                 console.log("Rate limit exceeded. Please try again later.");
//                 //when the rate limit happens, wait 60 seconds and try again
//                 await delay(60000);
//                 return await do_summary(text);
//             } 
//             else if(error.message.includes("400")){
//                 const summary1 = await do_summary(text.substring(0,text.length/2));
//                 const summary2 = await do_summary(text.substring(text.length/2,text.length-1));
//                 return summary1 + summary2;
//             }
//             else {
//                 console.error("An error occurred:", error.message);
//                 // General error handling
//             }
//         }
//     } else {
//         try {

//             const chunks = await chunkify_text(text, 30000);
//             const promises = chunks.map(async (value, i) => {
//                 return await do_summary(value);
//             });
//             const results = await Promise.allSettled(promises);
//             let successResults = results.filter((value, i) => { return value.status === "fulfilled" }).map((v, i) => { return JSON.stringify(v.value) });
//             const concatenated = successResults.join();
//             const summary = await do_summary(concatenated);
//             let endTime = performance.now();
//             // console.log(`The text size is ${text.length} characters. The time of summary is ${(endTime - startTime) / 1000} seconds`);
//             return summary;
//             //concatenated the previous summary to the current one
//             // const chunks = await chunkify_text(text, 3000);
//             // let summary = "";
//             // // const summaries = [];

//             // for (let i = 0; i < chunks.length; i++) {
//             //     const currentText = summary + chunks[i];
//             //     summary = await do_summary(currentText);
//             //     // summaries.push(summary);
//             //     // concatenatedSummaries += summary;
//             // }
//             // return summary;
//         }
//         catch (error) {
//             console.error(`error in do_summary ${error}`);
//         }
//     }

// }


// /**
//  * This function will recursive analyze the sub-directories/files of the current path, and then summarize them to get the analysis of the current path.
//  * @returns {object} repo_analysis -a object containing the analysis of the current repo in the form {path:string, type: string(dir,file), analysis: string, children:[array of the sub-directories/files analysis object]}. The children will be empty if it's a file
//  */
// async function do_analysis(repoLink, owner, repo, verbose) {
//     let startTime = performance.now();
//     if (verbose) {
//         console.log(`Processing the directory: ${repoLink}`);
//     }
//     let repository = await octokit.request('GET /repos/{owner}/{repo}', {
//         owner: owner,
//         repo: repo,
//         headers: {
//             'X-GitHub-Api-Version': '2022-11-28'
//         }
//     })

//     let result = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
//         owner: owner,
//         repo: repo,
//         tree_sha: repository.data.default_branch,
//         headers: {
//             'X-GitHub-Api-Version': '2022-11-28'
//         }
//     })
//     //the paths to and type of the root's directories and files
//     let paths = result.data.tree.map((value, index) => ({ path: value.path, type: value.type }));
//     let promises = paths.map(async item => {
//         return await recursive_analysis(item, owner, repo, verbose);
//     });

//     //summarize the analysis
//     let results = await Promise.allSettled(promises);
//     let concatenated = "";
//     let parseResults = results.map((item, i) => {
//         concatenated += JSON.stringify({
//             path: item.value.path,
//             type: item.value.type,
//             summary: (item.status === "fulfilled") ? item.value.summary : ""
//         }) + ",\n";
//         return item.value;  // or whatever transformation you want to apply
//     });
//     // console.log("children: ",children);
//     // console.log("concatenated in do_analysis: ", concatenated);

//     let summary = await do_summary(concatenated);
//     if (verbose) {
//         let endTime = performance.now();
//         console.log(`Finish Processing the directory: ${repoLink}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
//     }
//     return {
//         path: repoLink,
//         type: "dir",
//         summary: summary,
//         children: parseResults
//     };
// }

// /**
//  * 
//  * @param {object} item - {path:string,type:string}
//  */
// async function recursive_analysis(item, owner, repo, verbose) {
//     //if the file should be ignored, we just do summary based on its path instead of content
//     if (item.type === "blob" || item.type === "file") {
//         for (let m = 0; m < file_to_be_ignored.length; ++m) {
//             if (item.path.includes(file_to_be_ignored[m])) {
//                 console.log(`The file ${item.path} is ignored for content analysis. Its analysis is based solely on path name.`);
//                 let startTime = performance.now();
//                 if (verbose) {
//                     console.log(`Processing the file: ${item.path}`);
//                 }
//                 const summary = await do_summary(item.path);
//                 if (verbose) {
//                     let endTime = performance.now();
//                     console.log(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
//                 }
//                 return {
//                     path: item.path,
//                     type: "file",
//                     summary: summary
//                 }
//             }
//         }
//     }
//     const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
//         owner: owner,
//         repo: repo,
//         path: item.path,
//         headers: {
//             'X-GitHub-Api-Version': '2022-11-28'
//         }
//     });

//     if (item.type === "blob" || item.type === "file") {
//         //summarize the file's content
//         const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
//         // const content = return await file_analysis(item.path, decodedContent);
//         //TODO: add the name of the file to it as context
//         let startTime = performance.now();
//         if (verbose) {
//             console.log(`Processing the file: ${item.path}`);
//         }
//         const summary = await do_summary(decodedContent);
//         if (verbose) {
//             let endTime = performance.now();
//             console.log(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
//         }
//         return {
//             path: item.path,
//             type: "file",
//             summary: summary
//         }
//     }
//     else {
//         let startTime = performance.now();
//         if (verbose) {
//             console.log(`Processing the directory: ${item.path}`);
//         }
//         const promises = response.data.map(async (value, i) => {
//             return await recursive_analysis({ path: value.path, type: value.type }, owner, repo,true);
//         });
//         const results = await Promise.allSettled(promises);
//         let concatenated = "";
//         let parseResults = results.map((item, i) => {
//             concatenated += JSON.stringify({
//                 path: item.value.path,
//                 type: item.value.type,
//                 summary: (item.status === "fulfilled") ? item.value.summary : ""
//             }) + ",\n";
//             return item.value;  // or whatever transformation you want to apply
//         });
//         // console.log("parsedResults:",parseResults);
//         // console.log("concatenated:", concatenated);

//         let summary = await do_summary(concatenated);
//         if (verbose) {
//             let endTime = performance.now();
//             console.log(`Finish Processing the directory: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
//         }
//         return {
//             path: item.path,
//             type: "dir",
//             summary: summary,
//             children: parseResults
//         };
//     }
// }
function chunkify_text(text, chunkSize) {
    let startTime = performance.now();
    // create the chunks based only on fixed size
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    let endTime = performance.now();
    // console.log(`The size of the text is ${text.length} characters. The time of chunkify is ${(endTime - startTime) / 1000} seconds`);
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 
 * @param {string} text - the text to be summarized
 * 
 * 
 * split the text into chunks and summarize them, and them summarize the summaries recursively. use fixed chunk size 3000 characters here. and the output size will be 5x compressed here
 */
async function do_summary(text, attempt = 0) {
    let startTime = performance.now();
    let messages = [
        { role: "system", content: prompt_summarize },
        { role: "user", content: 'Here is the content: ' }
    ];
    const jsonData = {
        model: "gpt-3.5-turbo-1106",
        messages: messages
    };
    if (text.length <= 30000) {
        try {
            //just summarize the actual text
            messages[messages.length - 1].content += text;
            // jsonData.max_tokens = Math.max(1, Math.ceil(text.length *2));
            const completion = await openai.chat.completions.create(jsonData);
            return completion.choices[0].message.content;
        }
        catch (error) {
            if (error.message.includes("429")) {
                console.log(error);
                //when the rate limit happens, wait 60 seconds and try again
                if (attempt < 3) {
                    const reset_time = parseFloat(error.response.headers['x-ratelimit-reset-tokens']);
                    await delay((reset_time + Math.random()) * 1000);
                    return await do_summary(text, attempt + 1);
                }
                else {
                    return "The summary is unavailable.";
                }
            }
            else if (error.message.includes("400")) {
                const summary1 = await do_summary(text.substring(0, text.length / 2));
                const summary2 = await do_summary(text.substring(text.length / 2, text.length - 1));
                return summary1 + summary2;
            }
            else {
                console.error("An error occurred:", error.message);
                // General error handling
            }
        }
    } else {
        try {

            const chunks = await chunkify_text(text, 30000);
            const promises = chunks.map(async (value, i) => {
                return await do_summary(value);
            });
            const results = await Promise.allSettled(promises);
            let successResults = results.filter((value, i) => { return value.status === "fulfilled" }).map((v, i) => { return JSON.stringify(v.value) });
            const concatenated = successResults.join();
            const summary = await do_summary(concatenated);
            let endTime = performance.now();
            // console.log(`The text size is ${text.length} characters. The time of summary is ${(endTime - startTime) / 1000} seconds`);
            return summary;
        }
        catch (error) {
            console.error(`error in do_summary ${error}`);

        }
    }

}


/**
 * This function will recursive analyze the sub-directories/files of the current path, and then summarize them to get the analysis of the current path.
 * @returns {object} repo_analysis -a object containing the analysis of the current repo in the form {path:string, type: string(dir,file), analysis: string, children:[array of the sub-directories/files analysis object]}. The children will be empty if it's a file
 */
async function do_analysis(repoLink, owner, repo, verbose, processing_detail, sessionId, redisClient) {
    let startTime = performance.now();

    let intervalId = setInterval(async () => {
        await redisClient.set(`progress:${sessionId}`, JSON.stringify(processing_detail));
    }, 10000); //update the processing_detail every ten seconds
    if (verbose) {
        console.log(`Processing the directory: ${repoLink}`);
        processing_detail.push(`Processing the directory: ${repoLink}`);
    }
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
        return await recursive_analysis(item, owner, repo, verbose, processing_detail, redisClient);
    });

    //summarize the analysis
    let results = await Promise.allSettled(promises);
    let concatenated = "";
    let parseResults = results.map((item, i) => {
        concatenated += JSON.stringify({
            path: item.value.path,
            type: item.value.type,
            summary: (item.status === "fulfilled") ? item.value.summary : "The summary is unavailable. You should infer it based on the path."
        }) + ",\n";
        return item.value;  // or whatever transformation you want to apply
    });
    // console.log("children: ",children);
    // console.log("concatenated in do_analysis: ", concatenated);

    let summary = await do_summary(concatenated);
    if (verbose) {
        let endTime = performance.now();
        console.log(`Finish Processing the directory: ${repoLink}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
        processing_detail.push(`Finish Processing the directory: ${repoLink}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
    }
    await redisClient.set(`progress:${sessionId}`, JSON.stringify(processing_detail));
    clearInterval(intervalId);
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
async function recursive_analysis(item, owner, repo, verbose, processing_detail, redisClient) {
    //if the file should be ignored, we just do summary based on its path instead of content
    if (item.type === "blob" || item.type === "file") {
        for (let m = 0; m < file_to_be_ignored.length; ++m) {
            if (item.path.includes(file_to_be_ignored[m])) {
                console.log(`The file ${item.path} is ignored for content analysis. Its analysis is based solely on path name.`);
                let startTime = performance.now();
                if (verbose) {
                    console.log(`Processing the file: ${item.path}`);
                    processing_detail.push(`Processing the file: ${item.path}`);
                }
                const summary = await do_summary(item.path);
                if (verbose) {
                    let endTime = performance.now();
                    console.log(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
                    processing_detail.push(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
                }
                return {
                    path: item.path,
                    type: "file",
                    summary: summary
                }
            }
        }
    }
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
        let startTime = performance.now();
        if (verbose) {
            console.log(`Processing the file: ${item.path}`);
            processing_detail.push(`Processing the file: ${item.path}`);
        }
        const summary = await do_summary(decodedContent);
        if (verbose) {
            let endTime = performance.now();
            console.log(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
            processing_detail.push(`Finish Processing the file: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
        }
        return {
            path: item.path,
            type: "file",
            summary: summary
        }
    }
    else {
        let startTime = performance.now();
        if (verbose) {
            console.log(`Processing the directory: ${item.path}`);
            processing_detail.push(`Processing the directory: ${item.path}`);
        }
        const promises = response.data.map(async (value, i) => {
            return await recursive_analysis({ path: value.path, type: value.type }, owner, repo, true, processing_detail, redisClient);
        });
        const results = await Promise.allSettled(promises);
        let concatenated = "";
        let parseResults = results.map((item, i) => {
            concatenated += JSON.stringify({
                path: item.value.path,
                type: item.value.type,
                summary: (item.status === "fulfilled") ? item.value.summary : "The summary is unavailable. You should infer it based on the path."
            }) + ",\n";
            return item.value;  // or whatever transformation you want to apply
        });
        // console.log("parsedResults:",parseResults);
        // console.log("concatenated:", concatenated);

        let summary = await do_summary(concatenated);
        if (verbose) {
            let endTime = performance.now();
            console.log(`Finish Processing the directory: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
            processing_detail.push(`Finish Processing the directory: ${item.path}. The processing takes ${(endTime - startTime) / 1000} seconds.`);
        }
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
    const repo_analysis = await do_analysis("https://github.com/facebook/react", "facebook","react",true);
    const endTime = performance.now();
    console.log(repo_analysis);
    console.log("successfully do the repo_analysis");
    console.log(`The analysis of the repo takes ${(endTime - beginTime) / 1000} seconds`);
    fs.writeFileSync('output.txt', JSON.stringify(repo_analysis, null, 2), 'utf8');
} catch (error) {
    console.error(`error in do_analysis in retrieve_code: ${error || error.status}`);
}
