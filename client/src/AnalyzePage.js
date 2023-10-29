import React, { useState,useEffect } from 'react';
import Inputbox from './Inputbox.js';
import './AnalyzePage.css';


// function AnalyzePage({ repoLink }) {

//     console.log('repoLink:', repoLink);
//     const [result, setResult] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [question,setQuestion] = useState("");
//     const [answer,setAnswer] = useState("");
//     const [history,setHistory] = useState([]);
//     const [sessionId,setSessionId] = useState(null);
//     // let history = [];
//     useEffect(() => {
//         const fetchData = async () => {
//             console.log('fetchData called');
//             try {
//                 const response = await fetch("http://localhost:8000/api/retrieve-code", {
//                     method: 'POST',
//                     headers: {
//                         'Content-type': 'application/json'
//                     },
//                     body: JSON.stringify({ link: repoLink })
//                 });

//                 if (!response.ok) {
//                     throw new Error(`HTTP error! Status: ${response.status}`);
//                 }

//                 const jsonResponse = await response.json();
//                 setSessionId(jsonResponse.sessionId);
//                 setResult(jsonResponse);
//                 console.log("result:",result);
//             } catch (error) {
//                 console.error(`Error! Status: ${error.status || error}.`);
//                 setError(error);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchData();
//     }, [repoLink]); // Re-run effect when repoLink changes

//     //send the question back to the server and get the response
//     useEffect(() => {
//         const answer_question = async () => {
//             console.log("received question:", question);
//             console.log("send the question to the server");
//             try {
//                 const response = await fetch("http://localhost:8000/api/answer-question", {
//                     method: "POST",
//                     headers: {
//                         'Content-type': 'application/json'
//                     },
//                     body: JSON.stringify({ sessionId:sessionId,question: question,link:repoLink})
//                 });
//                 if (!response.ok) {
//                     throw new Error(`HTTP error! Status: ${response.status}`);
//                 }

//                 const jsonResponse = await response.json();
//                 setHistory(prevHistory => [...prevHistory, { question, answer: jsonResponse }]);
//                 setAnswer(jsonResponse);
//                 console.log("question:", question);
//                 console.log("answer:",jsonResponse);
//             }
//             catch (error) {
//                 console.error(`Error! Status: ${error.status || error}.`);
//                 setError(error);
//             } 
            
//         }
//         if(question){
//             answer_question(history);
//         }
        
//     },[question]);

//     if (loading) return <p>Loading...</p>;
//     if (error) return <p>Error: {error.message}</p>;

    


//     return (
//         <div>
//             {
//             result ?
//                 (
//                     <div>
//                         <h2>Summary</h2>
//                         <p>{result.summary}</p>

//                         <h2>Directories</h2>
//                         <ul>
//                             {result.directories.map((dir, index) => (
//                                 <li key={index}>{dir.path} - {dir.summary}</li>
//                             ))}
//                         </ul>

//                         <h2>Files</h2>
//                         <ul>
//                             {result.files.map((file, index) => (
//                                 <li key={index}>{file.path} - {file.summary}</li>
//                             ))}
//                         </ul>
//                     </div>
//                 ) : <p>Still analyzing</p>
//             }
//             <div style={{ border: '2px solid #000', padding: '10px', marginTop: '20px' }}>
//                 {
//                     history.map((interaction, index) => (
//                         <div key={index}>
//                             <p><strong>Question:</strong> {interaction.question}</p>
//                             <p><strong>Answer:</strong> {interaction.answer}</p>
//                         </div>
//                     ))
//                 }
//             </div>
//             {<Inputbox setQuestion={setQuestion}/>}
//         </div>
//     );
// }




// export default AnalyzePage;


function AnalyzePage({ repoLink }) {
    console.log('repoLink:', repoLink);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [question, setQuestion] = useState("");
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("http://localhost:8000/api/retrieve-code", {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json'
                    },
                    body: JSON.stringify({ link: repoLink })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const jsonResponse = await response.json();
                setSessionId(jsonResponse.sessionId);
                setResult(jsonResponse);
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [repoLink]);

    // useEffect(() => {
    //     const answer_question = async () => {
    //         try {
    //             setHistory(prevHistory => [...prevHistory, { type: 'question', content: question }]);
    //             const response = await fetch("http://localhost:8000/api/answer-question", {
    //                 method: "POST",
    //                 headers: {
    //                     'Content-type': 'application/json'
    //                 },
    //                 body: JSON.stringify({ sessionId: sessionId, question: question+`\n sessionId: ${sessionId}`, link: repoLink })
    //             });

    //             if (!response.ok) {
    //                 throw new Error(`HTTP error! Status: ${response.status}`);
    //             }

    //             const jsonResponse = await response.json();
    //             setHistory(prevHistory => [...prevHistory, { type: 'answer', content: jsonResponse }]);
    //         }
    //         catch (error) {
    //             setError(error);
    //         }
    //     }

    //     if (question) {
    //         answer_question();
    //     }
    // }, [question]);
    useEffect(() => {
        const answer_question = async () => {
            try {
                // Add question to history
                setHistory(prevHistory => [...prevHistory, { type: 'question', content: question }]);

                // Add a "loading" message for the answer
                setHistory(prevHistory => [...prevHistory, { type: 'answer', content: "Loading..." }]);

                const response = await fetch("http://localhost:8000/api/answer-question", {
                    method: "POST",
                    headers: {
                        'Content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        question: question + `remember to include the sessionId if you call functions. sessionId: ${sessionId}`,
                        link: repoLink
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const jsonResponse = await response.json();

                // Replace "loading" with the actual answer
                setHistory(prevHistory => {
                    let updatedHistory = [...prevHistory];
                    updatedHistory[updatedHistory.length - 1].content = jsonResponse;
                    return updatedHistory;
                });
            }
            catch (error) {
                setError(error);
            }
        }

        if (question) {
            answer_question();
        }
    }, [question]);

    if (loading){
        return <p>This is the first time I am seeing this repo. I need to analyze it first. The analysis usually takes about 1 to 5 minutes.</p>;
    } 
    if (error) return <p>Error: {error.message}</p>;

    return (
        <div>
            {/* {
                result ? (
                    <div>
                        <h2>Summary</h2>
                        <p>{result.summary}</p>
                        <h2>Directories</h2>
                        <ul>
                            {result.directories.map((dir, index) => (
                                <li key={index}>{dir.path} - {dir.summary}</li>
                            ))}
                        </ul>
                        <h2>Files</h2>
                        <ul>
                            {result.files.map((file, index) => (
                                <li key={index}>{file.path} - {file.summary}</li>
                            ))}
                        </ul>
                    </div>
                ) : <p>Still analyzing</p>
            } */}
            {/* <div className="chat-container">
                {
                    history.map((interaction, index) => (
                        <div key={index} className={`message ${interaction.type}`}>
                            <p>{interaction.content}</p>
                        </div>
                    ))
                }
            </div> */}
            {
                history.map((interaction, index) => (
                    <div key={index} className={`message ${interaction.type}`}>
                        <p>{interaction.content}</p>
                    </div>
                ))
            }
            {/* <Inputbox setQuestion={setQuestion} /> */}
            <div className="inputbox-container">
                <Inputbox setQuestion={setQuestion} />
            </div>

        </div>
    );
}

export default AnalyzePage;
