import express, { json } from "express";
import cors from "cors";
import nlp from "compromise";
import fs, { readSync} from "fs";
import {do_analysis,do_summary} from "./do_analysis.js";
import {encode} from "gpt-3-encoder";
import Repo from "./model/repo_summary.js"
import functions from "./Prompts/functions.js";
import decorated_prompt from './Prompts/systems/gpt_doc.js'
import { Octokit } from "@octokit/rest";
// import { process } from './env.js'
import 'dotenv/config';
import OpenAI, { NotFoundError } from 'openai';
import mongoose from "mongoose";
const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API 
});
import {v4 as uuidv4} from "uuid";
import redis from 'redis';
import { createCipheriv } from "crypto";
import { fileURLToPath } from 'url';
import path,{dirname} from "path";

const MESSAGE_SUMMARY_WARNING_TOKEN = 10000;
const CHAT_MODEL = "gpt-3.5-turbo-16k";
// const CHAT_MODEL="gpt-4-32k";


let redisClient;

(async () => {
    redisClient = redis.createClient(process.env.REDIS_URL || 'localhost:6379');
    

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


// const port = 8000;
const app = express();
app.use(cors());
app.use(express.json());
// app.use(express.static('public'));
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// app.use(express.static(path.join(__dirname, '../client/build')));


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
async function chatCompletion(sessionId, model = CHAT_MODEL,functions=null,functionCall=null,time_perf=false,prompt=""){
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

function get_paths(repo_analysis,paths){
    paths.push(repo_analysis.path);
    if(repo_analysis.children){
        for (let i = 0; i < repo_analysis.children.length; i++) {
            get_paths(repo_analysis.children[i],paths);
        }
    }
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
    
    try{
        //search the db for the summary
        let repoAnalysis = await Repo.findOne({ path: repoLink });
        if(!repoAnalysis){
            // res.json({sessionId:sessionId,message:"This is the first time I have seen this repo. I will process it now. It may take some time..."});

            const beginTime = performance.now();
            repoAnalysis = await do_analysis(repoLink, owner, repo,true);
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
        let paths = [];
        get_paths(repoAnalysis,paths);
        //TODO: the sessionId is now added to the system message and we rely on chatgpt to recall it. Think of a better way to store it. 
        const system_message_content = decorated_prompt(sessionId,paths);
        const systemMessage = JSON.stringify({ role: "system", content: system_message_content });
        await redisClient.rPush(sessionId, systemMessage, (err, listLength) => {
            if (err) console.error(err);
        });
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
            directories: repoAnalysis.children.filter((value,i)=>{return value.type ==="dir"}).map((value,i)=>{return {path:value.path,summary:value.summary}}),
            files: repoAnalysis.children.filter((value, i) => { return value.type === "file" })
        }

        await redisClient.rPush(sessionId, JSON.stringify({ role: "assistant", content: JSON.stringify(response) }), (err) => {
            if (err) console.error(err);
        });
        const messages = await redisClient.lRange(sessionId, 1,-1);
        // console.log(`Message_list in the retrieve code: ${messages}`);
        response.sessionId = sessionId;
        return res.json(response);
    }catch(error){
        console.error(`error in do_analysis in retrieve_code: ${error||error.status}`);
    }
})


async function summarize_messages_in_place(sessionId,repo_link,cutoff=null,first_time=false){
    //retrieve the conversation history from redis;
    let message_list = await redisClient.lRange(sessionId, 1, -1);
    message_list = message_list.map((value, index) => { return JSON.parse(value) });
    //if the first time summarization still results in exceeding, we trim the message to half
    if(!first_time){
        for(let i = message_list.length-2; i >= 1; --i){
            if(message_list[i].content){
                message_list[i].content = message_list[i].content.substring(0, message_list[i].content.length / 2);
            }
        }
    }
    // console.log(`message_list in summarize_messages_in_place before summarizing: ${message_list}`);
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
        index = Math.min(index, message_list.length - 3);//keep the last two messages
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

    let message_to_summarize = message_list.slice(1,index);//don't touch the systemt message
    console.log(`Attempting to summarize ${message_to_summarize.length } messages [1: ${index}] of ${ message_list.length }`);

    let summary = await do_summary(JSON.stringify(message_to_summarize));
    const packed_summary_message = {"role":"user","content":summary};
    message_list.splice(1,index-1,packed_summary_message);

    // console.log("message_list in summarize_in_place after summarizing: ",message_list);
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
async function get_ai_response(sessionId, model = CHAT_MODEL,function_call){
    try{
        let message_list = await redisClient.lRange(sessionId, 1, -1);
        // console.log(`messages_list in get_ai_response: ${message_list}`);
        message_list = message_list.map((value, index) => { return JSON.parse(value) });
        // console.log(`messages_list in get_ai_response: ${message_list}`);
        let response = await openai.chat.completions.create({
            model: model,
            messages:message_list,
            functions:functions,
            function_call:function_call
        });
        // Special case for 'length'
        // if (response.choices[0].finish_reason === 'length') {
        //     throw new Error('Finish reason was length (maximum context length)');
        // }

        // Catches for soft errors
        // if (!['stop', 'function_call'].includes(response.choices[0].finish_reason)) {
        //     throw new Error(`API call finish with bad finish reason: ${JSON.stringify(response)}`);
        // }

        return response;

    }catch(error){
        console.log("Error in get_ai_response: ",error);
        throw error;
    }
}



function packageFunctionResponse(wasSuccess, responseString, timestamp = null) {
    const currentLocalTime = new Date();
    let formattedTime = timestamp === null ? currentLocalTime.toLocaleString() : timestamp;
    let packagedMessage = {
        status: wasSuccess ? 'OK' : 'Failed',
        message: responseString,
        time: formattedTime,
    };

    return JSON.stringify(packagedMessage);
}

function helper_search(paths,results,summary_object){
    if (paths.includes(summary_object.path) && summary_object.summary){
        results.push(summary_object.summary);
    }
    if(summary_object.children){
        for (let m = 0; m < summary_object.children.length; ++m){
            helper_search(paths, results, summary_object.children[m]);
        }
    }
}

async function database_search(json_object){
    const paths = json_object.paths;
    const sessionId = json_object.sessionId;
    console.log(`Search in database for the paths: ${paths}`);
    try{
        //the repo_link is an array because it's retrieved by the lRnage function
        let repo_link = await redisClient.lRange(sessionId, 0, 0);
        repo_link = repo_link[0];
        const summary_object = await Repo.findOne({path:repo_link});
        if (!summary_object) {
            console.log(`No summary found for repo link: ${repo_link}`);
            return [];
        }
        const results = [];
        helper_search(paths, results, summary_object);
        return results;
    }catch(error){
        console.log(`Error in database search function: ${error}`);
        return {};
    }
}

async function code_search(json_object){
    const paths = json_object.paths;
    const sessionId = json_object.sessionId;
    console.log(`Search in code(Github) for the paths: ${paths}`);
    let promises = [];
    const repo_link = await redisClient.lRange(sessionId, 0, 0);
    //the repo_link is an array because it's retrieved by the lRnage function
    const [owner,repo] = owner_repo(repo_link[0]);
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
        await redisClient.rPush(sessionId, JSON.stringify(response_message));

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
            console.log(`Error calling function ${function_name} with arguments ${JSON.stringify(function_args)}: ${error}`);
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
 * @param {string} sessionId 
 * @param {string} repo_link
 * @param {string} user_message 
 * @param {bool} first_message  -if this user_message is processed for the first time
 * @param {bool} first_question -if this is the first question in the chat history
 */
async function step(sessionId,repo_link,user_message,first_message=true,first_question=false){
    
    try{
        //step0: add user message if it's the first time it's seen
        if(first_message){
            await redisClient.rPush(sessionId, JSON.stringify({ role: "user", content: user_message }));

        }
        

        //step1: send the conversation and available messages to gpt
        const response = await get_ai_response(sessionId, CHAT_MODEL,"auto");

        //step2: check if the LLM wanted to call a function
        const response_message = response.choices[0].message;
        const [all_response_messages,function_failed] = await handle_ai_response(sessionId,response_message);

        //step 3: extend the message_list(conversation history) with the function response
        all_response_messages.forEach(async (message,i)=>{
            await redisClient.rPush(sessionId, JSON.stringify(message));
        });

        //step 4: call the gpt again to create a second response if there is a function call
        if(response_message.function_call){
            const second_response = await get_ai_response(sessionId, CHAT_MODEL,"none");
            await redisClient.rPush(sessionId, JSON.stringify(second_response.choices[0].message));
            return second_response;
        }
        else{
            //if no function is called, return the first gpt response
            return response;
        }

    }catch(error){
        console.log(`step failed \n user_message = ${user_message} \n error = ${error}`);
        //if we have a context length alert, we trim the messages length and try again
        if (error.error.message.includes('maximum context length')) {
            // A separate API call to run a summarizer
            if(first_message){
                await summarize_messages_in_place(sessionId, repo_link, null, true);
            }
            else{
                await summarize_messages_in_place(sessionId, repo_link, null, false);
            }
            
            // Try step again
            return await step(sessionId,repo_link,user_message,false);
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
    // const [owner, repo] = owner_repo(repoLink);
    const sessionId = req.body.sessionId;
    
    const response = await step(sessionId,repoLink,question);
    const answer = response.choices[0].message.content;
    return res.json(answer);
});

// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../client/build/index.html'));
// });
const PORT = process.env.PORT || 8000;
app.listen(PORT, ()=>{
    console.log(`Server is running on http://localhost:${PORT}`);
})
