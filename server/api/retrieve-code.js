import { do_analysis, do_summary } from "../do_analysis.js";
import Repo from "../model/repo_summary.js"
// import { Octokit } from "@octokit/rest";
import 'dotenv/config';
// import mongoose from "mongoose";
import fs, { readSync } from "fs";
// import redis from 'redis';
import decorated_prompt from '../Prompts/systems/gpt_doc.js'
import {initialize_redis} from "../server.js";
// import { connect } from "http2";

let redisClient;
(async()=>{
    redisClient = await initialize_redis();
})();

// (async () => {
//     if (process.env.REDIS_URL) {
//         redisClient = redis.createClient({ url: process.env.REDIS_URL });
//     }
//     else {
//         redisClient = redis.createClient();
//     }

//     redisClient.on("error", (error) => console.error(`Error : ${error}`));

//     await redisClient.connect();
// })();

// mongoose.connect(URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// });

// const connection = mongoose.connection;
// connection.once("open", () => {
//     console.log("connect to the mongodb successfully");
// })


function get_paths(repo_analysis, paths) {
    paths.push(repo_analysis.path);
    if (repo_analysis.children) {
        for (let i = 0; i < repo_analysis.children.length; i++) {
            get_paths(repo_analysis.children[i], paths);
        }
    }
}

export async function handle_retrieve_code(data) {
    const { repoLink, owner, repo, sessionId } = data;
    console.log("enter the handle_retrieve_code function");
    try {
        //search the db for the summary
        let repoAnalysis = await Repo.findOne({ path: repoLink });
        if (!repoAnalysis) {
            // res.json({sessionId:sessionId,message:"This is the first time I have seen this repo. I will process it now. It may take some time..."});

            const beginTime = performance.now();
            repoAnalysis = await do_analysis(repoLink, owner, repo, true);
            const endTime = performance.now();
            console.log(repoAnalysis);
            console.log("successfully do the repo_analysis");
            console.log(`The analysis of the repo takes ${(endTime - beginTime) / 1000} seconds`);
            fs.writeFileSync('output.txt', JSON.stringify(repoAnalysis, null, 2), 'utf8');
            //store it back to the db
            const newRepo = new Repo({
                path: repoLink,
                type: "dir",
                summary: repoAnalysis.summary,
                children: repoAnalysis.children
            })
            await newRepo.save();
        }
        console.log("finsiht repo analysis");
        let paths = [];
        get_paths(repoAnalysis, paths);
        //TODO: the sessionId is now added to the system message and we rely on chatgpt to recall it. Think of a better way to store it. 
        const system_message_content = decorated_prompt(sessionId, paths);
        const systemMessage = JSON.stringify({ role: "system", content: system_message_content });
        await redisClient.rPush(sessionId, systemMessage, (err, listLength) => {
            if (err) console.error(err);
        });
        await redisClient.expire(sessionId, 3600);
        // console.log("retrieve the analysis from db");
        //we will add a fake question to the chathistory
        const fakeQustion = JSON.stringify({
            role: "user", content: `Using the provided README.md content and list of directory / file paths from a GitHub repository, please:
        - Summarize the repository's purpose based on the README.md and path names.
        - Analyze each directory and file in the root, providing explanations or assumptions about their functionalities.`});

        await redisClient.rPush(sessionId, fakeQustion, (err, listLength) => {
            if (err) console.error(err);
        });
        await redisClient.expire(sessionId, 3600);
        const response = {
            summary: repoAnalysis.summary,
            directories: repoAnalysis.children.filter((value, i) => { return value.type === "dir" }).map((value, i) => { return { path: value.path, summary: value.summary } }),
            files: repoAnalysis.children.filter((value, i) => { return value.type === "file" })
        }

        await redisClient.rPush(sessionId, JSON.stringify({ role: "assistant", content: JSON.stringify(response) }), (err) => {
            if (err) console.error(err);
        });
        await redisClient.expire(sessionId, 3600);
        const messages = await redisClient.lRange(sessionId, 1, -1);
        await redisClient.expire(sessionId, 3600);
        // console.log(`Message_list in the retrieve code: ${messages}`);
        response.sessionId = sessionId;
        // return res.json(response);
        return response;
    } catch (error) {
        console.error(`error in do_analysis in retrieve_code: ${error || error.status}`);
    }
}