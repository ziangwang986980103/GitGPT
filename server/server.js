import express, { json } from "express";
import cors from "cors";
import nlp from "compromise";
import fs, { readSync } from "fs";
import {do_analysis,do_summary} from "./do_analysis.js";
import {encode} from "gpt-3-encoder";
import Repo from "./model/repo_summary.js"
import functions from "./Prompts/functions.js";
import system_prompt from './Prompts/systems/gpt_doc.js'
import { Octokit } from "@octokit/rest";
import { process } from './env.js'
import OpenAI, { NotFoundError } from 'openai';
import mongoose from "mongoose";
const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API 
});
import {v4 as uuidv4} from "uuid";
import redis from 'redis';
import { createCipheriv } from "crypto";

const MESSAGE_SUMMARY_WARNING_TOKEN = 10000;


let redisClient;

(async () => {
    redisClient = redis.createClient();

    redisClient.on("error", (error) => console.error(`Error : ${error}`));

    await redisClient.connect();
})();

const URI = process.env.MONGODB_URI;

mongoose.connect(URI,{
    useNewUrlParser:true,
    useUnifiedTopology:true,
});

const connection = mongoose.connection;
connection.once("open",()=>{
    console.log("connect to the mongodb successfully");
})


const port = 8000;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


/**
 * @param {string} text - the input text
 * @returns {int} - the number of tokens in the input string
 * reference: https://stackoverflow.com/questions/76887648/how-to-calculate-the-token-of-the-entire-chatgpt-conversation
 */
function countTokens(text) {
    let tokens_per_message = 4;
    let tokens_per_name = 1;
    let num_tokens = 0;
    num_tokens += tokens_per_message;
    for (let key in text) {
        let value = text[key];
        num_tokens += encode(value).length;
        if (key == "name") {
            num_tokens += tokens_per_name;
        }
        
    }
    num_tokens += 3;
    return num_tokens;
}

// /**
//  * 
//  * @param {array} messages 
//  * @param {string} model 
//  * @returns {int} - the number of tokens in the messages
//  * referece: https://stackoverflow.com/questions/76887648/how-to-calculate-the-token-of-the-entire-chatgpt-conversation
//  */
// function numTokensFromMessages(messages, model = "gpt-3.5-turbo-16k-0613") {
//     let tokens_per_message = 0;
//     let tokens_per_name = 0;
//     if (["gpt-3.5-turbo-0613", "gpt-3.5-turbo-16k-0613", "gpt-4-0314", "gpt-4-32k-0314", "gpt-4-0613", "gpt-4-32k-0613"].includes(model)) {
//         tokens_per_message = 3;
//         tokens_per_name = 1;
//     } else if (model == "gpt-3.5-turbo-0301") {
//         tokens_per_message = 4;
//         tokens_per_name = -1;
//     } else if (model.includes("gpt-3.5-turbo")) {
//         console.log("Warning: gpt-3.5-turbo may update over time. Returning num tokens assuming gpt-3.5-turbo-0613.");
//         return numTokensFromMessages(messages, "gpt-3.5-turbo-0613");
//     } else if (model.includes("gpt-4")) {
//         console.log("Warning: gpt-4 may update over time. Returning num tokens assuming gpt-4-0613.");
//         return numTokensFromMessages(messages, "gpt-4-0613");
//     } else {
//         throw new Error(`num_tokens_from_messages() is not implemented for model ${model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
//     }
//     let num_tokens = 0;
//     for (let i = 0; i < messages.length; i++) {
//         let message = messages[i];
//         num_tokens += tokens_per_message;
//         for (let key in message) {
//             let value = message[key];
//             num_tokens += encode(value).length;
//             if (key == "name") {
//                 num_tokens += tokens_per_name;
//             }
//         }
//     }
//     num_tokens += 3;
//     return num_tokens;
// }



/**
 * Make a call to the Chatgpt API, checks if a functions is called. If so, return an object containing the name and arguments of the function.
 * If not, return an object containing "general" as the name and the response from the chatgpt as content. This function will not update the messages
 * array, it's the job for the caller.
 * @param {string} model 
 * @param {Array} messages 
 * @param {Array} functions 
 * @param {Array} functionCall 
 * @param {Boolean} time_perf 
 * @param {string} prompt - the prompt that is added to the current prompt for bettter result
 * @returns {Object} {name: string, content: string}
 */
async function chatCompletion(sessionId,model="gpt-3.5-turbo-16k",functions=null,functionCall=null,time_perf=false,prompt=""){
    let startTime = performance.now();
    let historyList;
    try{
        historyList = await redisClient.lRange(sessionId, 0, -1);
        historyList =historyList.map((value,index)=>{return JSON.parse(value)});
    }catch(err){
        console.error("Error in get the history list ",err);
    }

    if(prompt !== ""){
        historyList[historyList.length-1].content += prompt;
    }
    const jsonData = {model:model,messages:historyList};
    if(functions !== null){
        jsonData.functions = functions;
    }
    if(functionCall !== null){
        jsonData.functionCall = functionCall;
    }
    try{
        // console.log("jsonData: ",jsonData);
        const completion = await openai.chat.completions.create(jsonData);
        let endTime = performance.now();
        let timediff = (endTime - startTime) / 1000;
        if (time_perf){
            console.log(`The ChatGpt spends ${timediff} seconds`);
        }
        const responseMessage = completion.choices[0].message;
        if (responseMessage.function_call) {
            return { name: responseMessage.function_call.name, content: responseMessage.function_call.arguments };
        }
        else {
            return { name: "general", content: completion.choices[0].message.content };
        }
    }catch(error){
        console.error(`Failed to call ChatGPT API: ${error.status || error}`);
        console.log("json data:",jsonData);
        return null;
    }
    
}


// /**
//  * Analyze the github repo and return the summary of the repo and explanaiton of each root directory and file.
//  * @param {Array} contents -array of metadata of each file/directory in the github repo
//  * @param {String} owner -owner of the github repo
//  * @param {String} repo -name of the github repo
//  * @returns {string} -the response from the chatgpt. It's a stringfied json object {summary: string, directories:[name: string, explanation: string], files:[name: string, explanation: string]}
//  */
// async function analyzeCode(sessionId,trees,owner,repo){
//     //get the content of README.md
//     let README;
//     try{
//         const response = await octokit.request('GET /repos/{owner}/{repo}/readme', {
//             owner: owner,
//             repo: repo,
//             headers: {
//                 'X-GitHub-Api-Version': '2022-11-28'
//             }
//         })
        
//         const contentBase64 = response.data.content;
//         if(response.data.content !== null){
//             console.log("response.data.content exist");
//         }
//         README = Buffer.from(contentBase64, 'base64').toString('utf-8');
//     }
//     catch(error){
//         console.error(`Failed to fetch README: ${error.status || error}`);
//         return null;
//     }
//     try{
//         const paths = trees.map(item=>{
//                 return { path: item.path, type: item.url?.includes("trees")?"directory":"file"};
//         })
        
//         const initialPrompt = `Using the provided README.md content and list of directory/file paths from a GitHub repository, please create a valid JSON object 
//                                that summarizes and analyzes the repository. Ensure that the JSON object adheres strictly to JSON syntax rules, including proper 
//                                string encapsulation and escaping of special characters. 

                                
//                                 `
        
//         await redisClient.rPush(sessionId, JSON.stringify({ role: "user", content: initialPrompt }),(err,listLength)=>{
//             if(err) console.error(err);
//         })

//         const prompt = `README.md Content: ${README}    
//                         Paths: ${JSON.stringify(paths)}`;
//         const response = await chatCompletion(sessionId,"gpt-3.5-turbo-16k", functions, null, true,prompt);
//         return response.content;
//     }
//     catch(error){
//         console.error(`Failed to analyze the repo: ${error.status || error}`);
//         return null;
//     }
    
    
// }

/**
 * @param {string} -the link of a github repository
 * @returns {string} -an array of owner and repo name of the link
*/
function owner_repo(repoLink){
    const match = repoLink.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        return res.status(400).json({ error: "Invalid github repo link" });
    }

    const owner = match[1];
    const repo = match[2];
    
    return [owner,repo];
}


/**
 * Receive the initial request from the user. Send back the initial analysis of the repo, and store the analysis into the database.
 */
app.post("/api/retrieve-code",async (req,res)=>{
    const repoLink = req.body.link;
    const [owner,repo] = owner_repo(repoLink);
    //create a new session for this request. The chat history will be stored as value of the key sessionId.
    const sessionId = uuidv4();
    //store the repoLink into the redis
    await redisClient.rPush(sessionId, repoLink);
    const systemMessage = JSON.stringify({ role: "system", content: system_prompt+sessionId});
    await redisClient.rPush(sessionId, systemMessage, (err, listLength) => {
        if (err) console.error(err);
    });
    try{
        //search the db for the summary
        let repoAnalysis = await Repo.findOne({ path: repoLink });
        if(!repoAnalysis){
            // res.json({sessionId:sessionId,message:"This is the first time I have seen this repo. I will process it now. It may take some time..."});
            const beginTime = performance.now();
            repoAnalysis = await do_analysis(repoLink, owner, repo);
            const endTime = performance.now();
            console.log(repoAnalysis);
            console.log("successfully do the repo_analysis");
            console.log(`The analysis of the repo takes ${(endTime - beginTime) / 1000} seconds`);
            fs.writeFileSync('output.txt', JSON.stringify(repoAnalysis, null, 2), 'utf8');
            //store it back to the db
            const newRepo = new Repo({
                path:repoLink,
                type:"dir",
                summary:repoAnalysis.summary,
                children:repoAnalysis.children
            })
            await newRepo.save();
        }
        // console.log("retrieve the analysis from db");
        //we will add a fake question to the chathistory
        const fakeQustion = JSON.stringify({
            role: "user", content: `Using the provided README.md content and list of directory / file paths from a GitHub repository, please:
        - Summarize the repository's purpose based on the README.md and path names.
        - Analyze each directory and file in the root, providing explanations or assumptions about their functionalities.`});

        await redisClient.rPush(sessionId, fakeQustion, (err, listLength) => {
            if (err) console.error(err);
        });
        const response = {
            summary: repoAnalysis.summary,
            directories: repoAnalysis.children.filter((value,i)=>{return value.type ==="dir"}),
            files: repoAnalysis.children.filter((value, i) => { return value.type === "file" })
        }

        await redisClient.rPush(sessionId, JSON.stringify({ role: "assistant", content: JSON.stringify(response) }), (err) => {
            if (err) console.error(err);
        });
        response.sessionId = sessionId;
        return res.json(response);
    }catch(error){
        console.error(`error in do_analysis in retrieve_code: ${error||error.status}`);
    }
})


// /**
//  * @param {string} path - the path to this file
//  * @param {string} input - the code to be analyzed
//  * @returns {object} -an object {path:path, analysis: string} 
//  */
// async function file_analysis(path,input) {
//     const MAX_RETRIES = 3;  // Define max number of retries if needed
//     let retryCount = 0;

//     async function callChatGPTAPI(input) {
//         let messages = [
//             { role: "system", content: "You are an assistant that provides detailed summaries of code snippets. Understand the code's main functionality, any functions or classes defined, their purposes, and any notable patterns or practices used." },
//             { role: "user", content: `Please provide a detailed summary of the following code, including its main functionality, any functions or classes defined, and their purposes, as well as any notable patterns or practices used. Here is the code: ${input}` }
//         ];
//         const jsonData = {
//             model: "gpt-3.5-turbo-16k",
//             messages: messages
//         };
//         return await openai.chat.completions.create(jsonData);
//     }

//     while (retryCount < MAX_RETRIES) {
//         try {
//             const completion = await callChatGPTAPI(input);
//             return {path:path,analysis:completion.choices[0].message.content};  // Successfully got the completion, return it
//         } catch (error) {
//             console.error(`Attempt ${retryCount + 1} failed: ${error.status || error}`);
//             if (error.status === 400) {
//                 // Shorten the input, for example by cutting it in half
//                 input = input.substring(0, Math.floor(input.length / 2));
//                 retryCount++;
//             } else {
//                 return {path:path,type:"file",analysis:"the analysis is not available"};
//             }
//         }
//     }

//     // throw new Error('Max retries reached with ChatGPT API.');
// }

// /**
//  * 
//  * @param {string} text - a string to be split
//  * @param {int} leftTokens - the number of left tokens, each of the split string must have length smaller than lefttokens
//  * @returns {array} results - an array containing the split strings
//  */
// function splitResults(text,leftTokens) {
//     const doc = nlp(text);
//     const tokens = doc.terms().out('array'); // Tokenize the text

//     let results = [];
//     let currentChunk = "";
//     let currentChunkTokenCount = 0;

//     tokens.forEach(token => {
//         // If adding the current token doesn't exceed the limit
//         if (currentChunkTokenCount + 1 <= leftTokens) {
//             currentChunk += token;
//             if(token !== " "){
//                 currentChunk += " ";
//                 currentChunkTokenCount += 2;
//             }
//             else{
//                 currentChunkTokenCount += 1;
//             }
//         } else {
//             // If it does exceed, save the current chunk and start a new one
//             results.push(currentChunk);
//             currentChunkTokenCount = 0;
//         }
//     });

//     // Add any remaining tokens
//     if (currentChunk.length > 0) {
//         results.push(currentChunk);
//     }

//     return results;
// }

// /**
//  * Analyzes a directory. Recursively retrieves the code of each sub-files and directories, and send them to chatgpt for analysis.
//  * Create a json object that has the same structure as the directory, and append the analysis of each files/directories.
//  * @param {Array} data -an array received from github
//  * @param {Array} path - the path to this directory
//  * @param {string} repo - repository name
//  * @param {string} owner - owner name
//  * @returns {object}
//  */
// async function recursive_analyze_directory(data,path, repo, owner) {
//     // If the data doesn't contain any data, return empty object
//     if (data.length === 0) {
//         return {};
//     }

//     let promises = [];
//     try{
//         promises = data.map(async item => {
//             // Retrieve the code
//             const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
//                 owner: owner,
//                 repo: repo,
//                 path: item.path,
//                 headers: {
//                     'X-GitHub-Api-Version': '2022-11-28'
//                 }
//             });

//             if (response.data.type && response.data.type === "file") {
//                 // If it's a file and has content, decode and analyze
//                 const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
//                 return await file_analysis(item.path, decodedContent);
//             } else {
//                 return await recursive_analyze_directory(response.data,item.path, repo, owner);
//             }
//         });
//     }catch(error){
//         console.error(`create the promises list error in the recursive_directory_analysis: ${error.status||error}`);
//         // console.log("data:",data);
//     }
    
//     // Wait for all promises to resolve and return the results
//     let results = await Promise.all(promises);
//     //remove the children to save tokens
//     results.map((value,index)=>{
//         return {path:value.path,type:value.type,analysis:value.analysis};
//     });

    
//     //use the analysis of the sub-directories and sub-files to get the analysis of this directory
//     let messages = [{ role: "system", content: "You are an assistant that provides detailed summaries of a github directory. Understand the sub-directories and sub-files' main functionality , their purposes, and any notable patterns or practices used." },
//         { role: "user", content: `Please provide a brief summary of this directory, including its main functionality, its relationship with its sub-directories and sub-files. I will provide you with an analysis of its subdirectories and subfiles. This 
//         analysis maybe incomplete due to the token limits. You just have to focus on the existing directories and files. Important: you should make the response concise and don't exceed 1000 tokens. You can refer to the analysis of its subdirectories and subfiles here: ` }
//     ];
//     //we will devide the total tokens by 2 to leave enough space for output tokens. TODO: think of a better way to handle this problem 
//     const lefttokens = (16000 - numTokensFromMessages(messages))/2;
//     let split = splitResults(JSON.stringify(results),lefttokens);
//     let promises2 = split.map(async (value,index)=>{
//         let tempMessages = messages.slice();
//         tempMessages[tempMessages.length-1].content += value;
//         let tempNumOfTokens = numTokensFromMessages(tempMessages);
//         let json = { model:"gpt-3.5-turbo-16k",messages:tempMessages,max_tokens:16000-tempNumOfTokens};
//         return await openai.chat.completions.create(json);
//     });
//     const newResults = await Promise.all(promises2);
//     //then we need to summarize these results;
//     //TODO: the concatenatedResult may also exceed the token limit. we use truncation now, which is not optimal. try setting the max token paramter
//     let concatenatedResult = "";
//     newResults.forEach((value,index)=>{
//         concatenatedResult += value.choices[0].message.content;
//     })
//     // let tokenOfResult = countTokens(concatenatedResult);
//     //assume the averaged number of characters per token is 3, we will only leave the first 8000 tokens(24000 characters) of hte concatenatedResult
//     //, and we so we will leave enough space for the output
//     let endIndex = Math.min(concatenatedResult.length, 8000 * 3);
//     concatenatedResult = concatenatedResult.substring(0,endIndex);
//     let tempMessages = messages.slice();
//     tempMessages[tempMessages.length-1].content += " " + concatenatedResult;
//     let numOfTokens = numTokensFromMessages(concatenatedResult);
    
//     try{
//         const jsonData = { model: "gpt-3.5-turbo-16k", messages: tempMessages,max_tokens:16000-numOfTokens};
//         const completion = await openai.chat.completions.create(jsonData);
//         let ans = {};
//         ans.path = path;
//         ans.type = "directory";
//         ans.anlysis = completion.choices[0].message.content;
//         ans.children = results;
//         return ans;
//     }
//     catch(error){
//         console.error(`call chatgpt error in the recursive_directory_analysis:${error.status || error}`);
//     }
    
// }

// //TODO: adding the raw content of the related files will exceed token limit, think about a way to sovle it.
// /**
//  * Given the question and the paths to the related files and directories in the question, 
//  * ask the chatgpt to answer it and return the answer.
//  * @param {String} question -question from the user
//  * @param {Array} paths -paths to the related files and directories in the question
//  * @returns {String} -answer to the question from the chatgpt
//  */

// async function answer_question(sessionId,question, paths, owner, repo) {
//     console.log("answer_question is called");
//     let contents = [];
//     // console.log(`paths: ${paths}`);
//     if (paths !== null) {
//         // Fetch the content for each path
//         let promises = paths.map((value, index) => {
//             return octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
//                 owner: owner,
//                 repo: repo,
//                 path: value,
//                 headers: {
//                     'X-GitHub-Api-Version': '2022-11-28'
//                 }
//             }).then(response => {
//                 if (response.data.type && response.data.type === "file") {
//                     let decodedContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
//                     return { path: value, content: decodedContent };
//                     //set the path to null to test if the directory analysis works
//                     // return {path: value,content:""};
//                 } else {
//                     //set the analysis of the directory to null in order to test if the file analysis works.
//                     return { path: value, content: null };
//                     // console.log("should be an array data in the response. Response:", response);
//                     // return recursive_analyze_directory(response.data,value,repo,owner);
//                 }
//             });
//         });
//         // const directory_example = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
//         //     owner: "cpacker",
//         //     repo: "MemGPT",
//         //     path: "memgpt",
//         //     headers: {
//         //         'X-GitHub-Api-Version': '2022-11-28'
//         //     }
//         // })
//         // const file_example = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
//         //     owner: "cpacker",
//         //     repo: "MemGPT",
//         //     path: "main.py",
//         //     headers: {
//         //         'X-GitHub-Api-Version': '2022-11-28'
//         //     }
//         // })
//         // console.log("directory_example: ", directory_example);
//         // console.log("file_example",file_example);
//         // Wait for all promises to complete
//         contents = await Promise.all(promises);
//         // console.log(`contents: ${contents}`);
//     }

//     // Get the answer using chatCompletion API
//     //TODO: the contents may exceed the token limit, think about a way to fix it
//     const prompt = "\n" + "This is a list of files contents that are referred by the question" + JSON.stringify(contents) + "can you answered this question based on these files contents and the previous chat history? You don't need to mention that you have used the previous chat history in the answer";
//     // console.log("suffix prompt for a question: ",prompt);
//     const answer = await chatCompletion(sessionId,"gpt-3.5-turbo-16k", null, null, true,prompt);
//     return answer.content;
// }

async function summarize_messages_in_place(sessionId,repo_link,cutoff=null){
    //retrieve the conversation history from redis;
    let message_list = await redisClient.lRange(sessionId, 1, -1);
    message_list = message_list.map((value, index) => { return JSON.parse(value) });
    let index = cutoff;
    if(index === null){
        let tokens_so_far = 0;
        index = message_list.length-1;
        for(let m = message_list.length-1; m>=0; m--){
            tokens_so_far += countTokens(JSON.stringify(message_list[m]));
            if(tokens_so_far >= MESSAGE_SUMMARY_WARNING_TOKEN*0.2){
                break;
            }
            index = index-1;
        }
        index = Math.min(index,message_list.length-3);//keep the last two messages
    }

    try{
        if(message_list[index].role === "user"){
            console.log(`Selected cutoff ${index} was a 'user', shifting one...`);
            index += 1;
            if (message_list[index].role === "user"){
                console.log(`shifted cutoff ${index} is still a 'user', ignoring`);
            }
        }
    }catch(error){
        console.log(`error in shifting the cutoff: ${error}`);
    }

    let message_to_summarize = message_list.slice(1,index);
    console.log(`Attempting to summarize ${message_to_summarize.length } messages [1: ${index}] of ${ message_list.length }`);

    let summary = do_summary(JSON.stringify(message_to_summarize));
    const packed_summary_message = {"role":"user","content":summary};
    message_list.splice(1,index-1,packed_summary_message);

    //delete the original list
    try {
        // Delete the original list
        await redisClient.del(sessionId);
        //push the repo_link
        await redisClient.rPush(sessionId,repo_link);
        // Push the new list using a for...of loop to await each rPush operation
        for (let message of message_list) {
            await redisClient.rPush(sessionId, JSON.stringify(message));
        }

    } catch (error) {
        // Handle any errors
        console.error('Error when summarzing the messages:', error);

    }
}


/**
 * Base call to gpt w/ functions.
 * @param {string} sessionId 
 * @param {string} model 
 */
async function get_ai_response(sessionId, model = "gpt-3.5-turbo-16k",function_call){
    try{
        let message_list = await redisClient.lRange(sessionId, 1, -1);
        message_list = message_list.map((value, index) => { return JSON.parse(value) });
        let response = await openai.chat.completions.create({
            model: model,
            messages:message_list,
            functions:functions,
            function_call:function_call
        });
        // Special case for 'length'
        if (response.choices[0].finish_reason === 'length') {
            throw new Error('Finish reason was length (maximum context length)');
        }

        // Catches for soft errors
        if (!['stop', 'function_call'].includes(response.choices[0].finish_reason)) {
            throw new Error(`API call finish with bad finish reason: ${JSON.stringify(response)}`);
        }

        return response;

    }catch(error){
        console.log(error);
    }
}



function packageFunctionResponse(wasSuccess, responseString, timestamp = null) {
    let formattedTime = timestamp === null ? getLocalTime() : timestamp;
    let packagedMessage = {
        status: wasSuccess ? 'OK' : 'Failed',
        message: responseString,
        time: formattedTime,
    };

    return JSON.stringify(packagedMessage);
}

function helper_search(paths,results,summary_object){
    if(paths.includes(summary_object.path)){
        results.push(summary_object);
    }
    if(summary_object.children){
        for (let m = 0; m < summary_object.children.length; ++m){
            helper_search(paths, results, summary_object.children[m]);
        }
    }
}

async function database_search(paths,sessionId){
    console.log(`Search in database for the paths: ${paths}`);
    try{
        const repo_link = await redisClient.lRange(sessionId, 0, 0);
        const summary_object = await Repo.findOne(repo_link);
        const results = [];
        helper_search(paths, results, summary_object);
        return results;
    }catch(error){
        console.log(`Errror in database search function: ${error}`);
    }
}

async function code_search(sessionId,paths){
    console.log(`Search in code(Github) for the paths: ${paths}`);
    let promises = [];
    const repo_link = await redisClient.lRange(sessionId, 0, 0);
    const [owner,repo] = owner_repo(repo_link);
    try{
        promises = paths.map(async path => {
            // Retrieve the code
            const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: owner,
                repo: repo,
                path: path,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (response.data.type && response.data.type === "file") {
                // If it's a file and has content, decode and analyze
                const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
                return {path:path,content:decodedContent};
            } else {
                return { path: path, content: `${path} is not a code file.` };
            }
        });
        const results  = await Promise.all(promises);
        return results;
    }catch(error){
        console.error(`error in code search: ${error.status||error}`);
        return [];
    }
}


/**
 * Handles parsing and function calling.
 * @param {object} response_message 
 * 
 */
async function handle_ai_response(sessionId,response_message){
    //append this to the message_list(conversation history) after done
    let messages = []

    //step0: check if the gpt wanted to call a function
    if(response_message.function_call){
        //step1: call the function

        //extend the message_list with the assistant's reply 
        redisClient.rPush(sessionId, JSON.stringify(response_message));

        const available_functions ={
            "database_search":database_search,
            "code_search":code_search
        }

        //Failure case 1: function name is wrong
        const function_name = response_message.function_call.name;
        let function_to_call;
        try{
            function_to_call = available_functions[function_name];
        }catch(error){
            console.log(`No function name ${function_name}`);
            const error_function_response = packageFunctionResponse(false, `No function name ${function_name}`);
            messages.push({
                "role":"function",
                "name":function_name,
                "content": error_function_response
            });
            return [messages,true];
        }

        //Failure case 2: function args are bad json
        let function_args;
        let raw_function_args;
        try{
            raw_function_args = response_message.function_call.arguments;
            function_args = JSON.parse(raw_function_args);
        }catch(error){
            console.log(`Error parsing arguments for function ${function_name}, arguments: ${raw_function_args}`);
            const error_function_response = packageFunctionResponse(false, `Error parsing arguments for function ${function_name}, arguments: ${raw_function_args}`);
            messages.push({ 
                "role":"function",
                "name":function_name,
                "content": error_function_response
            });
            return [messages,true];
        }

        //Failure case 3: function failed during execution
        let function_response;
        try{
            const function_response_string  = await function_to_call(function_args);
            function_response = packageFunctionResponse(true, function_response_string);
            let function_failed = false;
        }catch(error){
            console.log(`Error calling function ${function_name} with arguments ${ISON.stringify(function_args)}: ${error}`);
            const error_function_response = packageFunctionResponse(false, `Error calling function ${function_name} with arguments ${function_args}: ${error}`);
            messages.push({
                "role": "function",
                "name": function_name,
                "content": error_function_response
            });
            return [messages,true];
        }

        //step 2: if no failure happens, send the info about function call and function response to gpt
        messages.push({
            "role": "function",
            "name": function_name,
            "content": function_response
        })
        
        return [messages,false];
    }
    else{
        //no function call
        messages.push(response_message);
        return [messages,null];

    }
}

/**
 * Top-level event message handler
 * @param {string} user_message 
 */
async function step(sessionId,repo_link,user_message){
    try{
        //step0: add user message
        await redisClient.rPush(sessionId, JSON.stringify({ role: "user", content: user_message }));

        //step1: send the conversation and available messages to gpt
        const response = await get_ai_response(sessionId, "gpt-3.5-turbo-16k","auto");

        //step2: check if the LLM wanted to call a function
        const response_message = response.choices[0].message;
        const [all_response_messages,function_failed] = await handle_ai_response(sessionId,response_message);

        //step 3: extend the message_list(conversation history) with the function response
        all_response_messages.forEach(async (message,i)=>{
            await redisClient.rPush(sessionId, JSON.stringify(message));
        });

        //step 4: call the gpt again to create a second response if there is a function call
        if(response_message.function_call){
            const second_response = await get_ai_response(sessionId, "gpt-3.5-turbo-16k","none");
            await redisClient.rPush(sessionId, JSON.stringify(second_response));
            return second_response;
        }
        else{
            //if no function is called, return the first gpt response
            return response;
        }

    }catch(error){
        console.log(`step failed \n user_message=${user_message} \n error=${error}`);
        //if we have a context length alert, we trim the messages length and try again
        if (error.message.includes('maximum context length')) {
            // A separate API call to run a summarizer
            await summarize_messages_in_place(sessionId,repo_link);
            // Try step again
            return await step(sessionId,user_message);
        } else {
            console.error(`step() failed with openai.InvalidRequestError, but didn't recognize the error message: '${error}'`);
            throw error;
        }
    }
}

/**
 * Receive the question from the user. Use chatgpt to extract the related files and directories in the question, and call
 * answer_question to answer the question.
 */
//TODO: use intent classification to identify the most relevant instructions for a user query;
//
app.post('/api/answer-question', async (req, res) => {
    
    const question = req.body.question;
    const repoLink = req.body.link;
    const [owner, repo] = owner_repo(repoLink);
    const sessionId = req.body.sessionId;
    
    const response = await step(sessionId,repoLink,question);
    const answer = response.choices[0].message.content;
    return res.json(answer);

    // let repository = await octokit.request('GET /repos/{owner}/{repo}', {
    //     owner: owner,
    //     repo: repo,
    //     headers: {
    //         'X-GitHub-Api-Version': '2022-11-28'
    //     }
    // })
    
    // let result = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1', {
    //     owner: owner,
    //     repo: repo,
    //     tree_sha: repository.data.default_branch,
    //     headers: {
    //         'X-GitHub-Api-Version': '2022-11-28'
    //     }
    // })
       
    // const trees = result.data.tree.map(item => ({ path: item.path, type: item.url?.includes("trees") ? "tree" : "blob" }));
    // await redisClient.rPush(sessionId, JSON.stringify({ role: "user", content: question }));
    // const prompt = `  Extract the path to the files and/or directories this question is referring to. Return an object in the format: {paths:[path1,path2,...]}. If there is no related files or directories in this question, return null. You should avoid 
    // adding redundant paths. For example, if you think a path to a directory should be added, then you should only add the path to the directory and avoid adding the paths to the files in that directory. You should only choose path from this array: ${JSON.stringify(trees)}`;
    // //TODO: this is call to chatgpt is trying to extract the related files/directories to this question. But we can't be sure the chatgpt
    // //will always return an  array of path back. So think about some ways to remedy it. Like using the enforced functions, or just past an empty array. 
    // const response = await chatCompletion(sessionId,"gpt-3.5-turbo-16k", null, null, true,prompt);
    // const parsedData = JSON.parse(response.content);
    // const paths = parsedData?parsedData.paths:null; 
    // const answer = await answer_question(sessionId,question,paths,owner,repo);
    // redisClient.rPush(sessionId, JSON.stringify({ role: "assistant", content:answer}));
    // return res.json(answer);
});

app.listen(port, ()=>{
    console.log(`Server is running on http://localhost:${port}`);
})
