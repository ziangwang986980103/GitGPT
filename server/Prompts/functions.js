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
                }
            }
        }
    }
]
export default functions;