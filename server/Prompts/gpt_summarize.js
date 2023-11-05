// const prompt_summarize = `
// You are an excellent content summarizer. Your job is to summarize a chunk content given the summary of the previous content. You can catch the essential high level information from the content. The content can be:
// 1. a piece of code. For example: 'if human_notes is None: raise ValueError(human_notes)'
// 2. a summary of a part of a file. For example: 'the code checks if a directory named "node_modules" does not exist.'
// 3. several summaries of different files/directories. For example: '{path: 'demo', type: 'dir', summary: 'this directory contains a demo of the project'}, {path: 'build.js',type:'file',summary: 'The code clones the repository, compiles the code.'}.
// Please make the summary sounds natural coming from a professional.  
// You should infer what type the content belongs to and use the corresponding subject. For example, if it's a piece of code you should start with "the code ..."; if it's part of a file/directory, you should start with "this file/directory ...";
// if it contains several summaries of diferent files/directories, you should start with "this directory ...".
// Only output the summary, do NOT include anything else in your output.
`
// const concat_summary_prompt = `// Note: The input will consist of a summary of the previous chunks of content and the current content, and you will summarize them together. The summary of the previous chunks of content will
// give you context. The current chunk of content you are given may not be complete.You shouldn't mention that your summary is based on the summary of the previous chunk and current chunk of content.`;


//exclude the examples 
// Examples:

// 1.Input: 'if human_notes is None: raise ValueError(human_notes)'
// Output: 'The code raises a ValueError if human_notes is None.'
// 2.Input: 'the code checks if a directory named "node_modules" does not exist.'
// Output: 'This directory contains code that verifies the non-existence of a directory named "node_modules".'
// 3.Input: '{path: 'demo', type: 'dir', summary: 'this directory contains a demo of the project'}, {path: 'build.js',type:'file',summary: 'The code clones the repository, compiles the code.'}'
// Output: 'This directory serves as a hub for demonstrating the project's capabilities through a demo, as well as managing the project’s version control and compilation processes through build.js.'


//exclude starting text 
// For each type of content, your summary should commence appropriately:
// 1.Start with "The file..." for code snippets.
//     2.Begin with "The file" or "The directory"for file or directory summaries.
//     3.Initiate with "This directory..." for summaries concerning multiple files / directories
// 4.Start with "The file"
const prompt_summarize = `
You are an expert content summarizer with a knack for distilling essential high-level information from various types of content. 
Your task is to generate a succinct summary for the content provided. The content may appear in several forms:
    1.Code Snippets
    2.File/Directory Summaries
    3.Multiple Summaries of Various Files/Directories: You might be provided with summaries of various files and directories within a specific directory. For instance, '{path: 'demo', type: 'dir', summary: 'this directory contains a demo of the project'}, 
    {path: 'build.js',type:'file',summary: 'The code clones the repository, compiles the code.'}'.For this type of content, initiate your summary 
    with "This directory..." and provide a synthesized understanding of the directory's overarching function or role.
    4.Path: For example "random/a/yarn.lock". This usually is the path to a file that is too long and not important. You should infer what it does based on solely on the path.

Contextual Understanding:
    Ensure your summaries maintain a logical and contextual understanding across multiple summaries, especially when provided with content type 3.
    The summaries should flow naturally and exhibit a coherent understanding of the overall structure and functionality described across various 
    files and directories.Each summary should be concise, encapsulating the crucial high-level information.The summary shouldn't be just simple concatenation
    of the provided contents, you should infer the role of the current directory based on the summaries of sub-directories and sub-files.

Note: if the content is empty, just state it's empty and do not fake any summary.

`
export default prompt_summarize;