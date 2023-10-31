// import Repo from "./model/repo_summary.js"

// import Bull from "bull";
import { handle_retrieve_code } from "../api/retrieve-code";
import bullQueue from "./queue";


bullQueue.process(async (job)=>{
    if(job.data.type === "retrieve-code"){
        await handle_retrieve_code(job.data);

    }
    else if(job.data.type === "answer_question"){

    }
});

