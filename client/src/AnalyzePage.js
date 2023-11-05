import React, { useState, useEffect } from 'react';
import Inputbox from './Inputbox.js';
import './AnalyzePage.css';



function AnalyzePage({ repoLink }) {
    console.log('repoLink:', repoLink);
    // const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [question, setQuestion] = useState("");
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [answerStatus, setAnswerStatus] = useState(0);
    // const [jobId,setJobId] = useState(null);
    //TODO: add a check to see if it's local development envirionment or not. 

    // useEffect(() => {
    //     const savedSessionId = sessionStorage.getItem('sessionId');
    //     const savedHistory = sessionStorage.getItem('history');

    //     if (savedSessionId) {
    //         setSessionId(savedSessionId);
    //         setLoading(false); // Assume if there's a session, loading is complete
    //     }

    //     if (savedHistory) {
    //         setHistory(JSON.parse(savedHistory));
    //     }
    // }, []);

    // useEffect(() => {
    //     if (sessionId) {
    //         sessionStorage.setItem('sessionId', sessionId);
    //     }
    // }, [sessionId]);

    // useEffect(() => {
    //     sessionStorage.setItem('history', JSON.stringify(history));
    // }, [history]);

    useEffect(() => {
        let intervalId;
        const fetchData = async () => {
            try {
                // const response = await fetch("http://localhost:8000/api/retrieve-code", {
                //     method: 'POST',
                //     headers: {
                //         'Content-type': 'application/json'
                //     },
                //     body: JSON.stringify({ link: repoLink })
                // });
                const response = await fetch("https://protected-eyrie-72539-1196ab347705.herokuapp.com/api/retrieve-code", {
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
                if (jsonResponse.sessionId) {
                    intervalId = setInterval(async () => {
                        try {
                            const response = await fetch(`https://protected-eyrie-72539-1196ab347705.herokuapp.com/api/job-status/retrieve-code/${jsonResponse.sessionId}`);
                            const data = await response.json();

                            if (data.status === 'completed') {
                                setLoading(false);
                                clearInterval(intervalId);
                            }
                        } catch (error) {
                            console.error("Error checking job status:", error);
                        }
                    }, 30000); // Poll every 30 seconds
                }
                


            } catch (error) {
                setError(error);
            }
        };
        fetchData();
        return () => clearInterval(intervalId);
    }, [repoLink]);




    useEffect(() => {
        let intervalId;
        const answer_question = async () => {
            try {
                // Add question to history
                setHistory(prevHistory => [...prevHistory, { type: 'question', content: question }]);

                // Add a "loading" message for the answer
                setHistory(prevHistory => [...prevHistory, { type: 'answer', content: "Loading..." }]);

                // const response = await fetch("http://localhost:8000/api/answer-question", {
                //     method: "POST",
                //     headers: {
                //         'Content-type': 'application/json'
                //     },
                //     body: JSON.stringify({
                //         sessionId: sessionId,
                //         question: question + ` \n remember to include the sessionId if you call functions. sessionId: ${sessionId}`,
                //         link: repoLink
                //     })
                // });
                const response = await fetch("https://protected-eyrie-72539-1196ab347705.herokuapp.com/api/answer-question", {
                    method: "POST",
                    headers: {
                        'Content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        question: question,
                        link: repoLink
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }


                // const jsonResponse = await response.json();

                intervalId = setInterval(async () => {
                    try {
                        const response = await fetch(`https://protected-eyrie-72539-1196ab347705.herokuapp.com/api/job-status/answer_question/${sessionId}`);
                        const data = await response.json();

                        if (data.status === 'completed') {
                            // setLoading(false);
                            setHistory(prevHistory => {
                                let updatedHistory = [...prevHistory];
                                updatedHistory[updatedHistory.length - 1].content = data.content;
                                return updatedHistory;
                            });
                            clearInterval(intervalId);
                        }
                    } catch (error) {
                        console.error("Error checking job status:", error);
                    }
                }, 5000); // Poll every 5 seconds

            }
            catch (error) {
                setError(error);
            }
        }

        if (question) {
            answer_question();
        }
        return () => clearInterval(intervalId);
    }, [question]);



    if (loading) {
        return <p>Hey there! I'm not familiar with this repo just yet. Let me take a moment to analyze it. It typically takes around 1 to 5 minutes. Sit tight, and I'll be right back with some insights!Please don't refresh the page!😊</p>;
    }
    if (error) return <p>Error: {error.message}</p>;

    return (
        <div>
            <div className="header">
                <a href={repoLink} target="_blank" rel="noopener noreferrer">{repoLink}</a>
            </div>
            {
                history.map((interaction, index) => (
                    <div key={index} className={`message ${interaction.type}`}>
                        <p>{interaction.content}</p>
                    </div>
                ))
            }
            <div className="inputbox-container">
                <Inputbox setQuestion={setQuestion} />
            </div>

        </div>
    );
}

export default AnalyzePage;