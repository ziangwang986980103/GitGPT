//this file lists all the functions that can be passed to the chatgpt api
let functions = [
    {
        "name":"database_search",
        "description":"search the summaries of files and/or directories using the paths to them",
        "parameters":{
            "type":"object",
            "properties":{
                "paths":{
                    "type":"array",
                    "description":"array of paths to files and/or directories. the length of this array shouldn't be more than 5.",
                    "items":{
                        "type":"string"
                    }
                },
                "sessionId":{
                    "type":"string",
                    "description":"the sessionId in the initial system message"
                }
            }
        }
    },
    

    {
        "name":"code_search",
        "description":"search the code of files from a github repo",
        "parameters": {
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "description": "array of paths to files.the length of this array shouldn't be more than 5.",
                    "items": {
                        "type": "string"
                    }
                },
                "sessionId": {
                    "type": "string",
                    "description": "the sessionId in the initial system message"
                }
            }
        }
    }

    // {
    //     "name": "initial_analysis",
    //     "description": `Using the provided README.md content and list of directory/file paths from a GitHub repository, please:
    //                     - Summarize the repository's purpose based on the README.md and path names.
    //                     - Analyze each directory and file in the root, providing explanations or assumptions about their functionalities.`,
    //     "parameters": {
    //         "type": "object",
    //         "properties": {
    //             "summary": {
    //                 "type": "string",
    //                 "description": "A general overview of this Github repo."
    //             },
    //             "directories": {
    //                 "type": "array",
    //                 "description": "analysis of each directory in the root, provdiding explanations or assumptions about their functionalities",
    //                 "items": {
    //                     "type": "object",
    //                     "description": "the name and explanation of a directory",
    //                     "properties": {
    //                         "name": {
    //                             "type": "string",
    //                             "description": "the name of a directory"
    //                         },
    //                         "explanation": {
    //                             "type": "string",
    //                             "description": "the explanation of a directory"
    //                         }
    //                     }
    //                 }
    //             },
    //             "files": {
    //                 "type": "array",
    //                 "description": "analysis of each file in the root, provdiding explanations or assumptions about their functionalities",
    //                 "items": {
    //                     "type": "object",
    //                     "description": "the name and explanation of a file",
    //                     "properties": {
    //                         "name": {
    //                             "type": "string",
    //                             "description": "the name of a file"
    //                         },
    //                         "explanation": {
    //                             "type": "string",
    //                             "description": "the explanation of a file"
    //                         }
    //                     }
    //                 }
    //             },
    //         },
    //         "required": ["summary", "directories", "files"]
    //     }
    // },
    // {
    //     "name":"project_explanation",
    //     "description": "give a detailed explanation on what this github repo/project is doing including the steps to run it, and the scenarios it can be applied.",
    //     "parameters":{
    //         "type": "object",
    //         "properties":{
    //             "explanation":{
    //                 "type":"string",
    //                 "description":"a detailed explanation on what this github repo/project is doing"
    //             },
    //             "running_steps":{
    //                 "type":"array",
    //                 "description":"list the steps to set up and run this github repo/project",
    //                 "items":{
    //                     "type":"string",
    //                 }
    //             },
    //             "scenarios":{
    //                 "type":"string",
    //                 "description":"explain what scenarions this project can bs used."
    //             }
    //         },
    //         "required":["explanation","scenarios"]
    //     }
    // },
    // {
        // "name":"extract_path",
        // "description":"extract the path to the files and/or directories the user is referring to",
        // "parameters":{
        //     "type":"object",
        //     "properties":{
        //         "paths":{
        //             "type": "array",
        //             "description":"list the paths to the files and/or directories the user is asking question about",
        //             "items":{
        //                 "type":"string"
        //             }
        //         }
        //     }
        // }
    // }
]
export default functions;