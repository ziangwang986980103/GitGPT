import React, { useState,useEffect } from 'react';
import Inputbox from './Inputbox.js';
import './AnalyzePage.css';



function AnalyzePage({ repoLink }) {
    console.log('repoLink:', repoLink);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [question, setQuestion] = useState("");
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    //TODO: add a check to see if it's local development envirionment or not. 
    useEffect(() => {
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
                setResult(jsonResponse);
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [repoLink]);

    
    useEffect(() => {
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
                        question: question + ` \n remember to include the sessionId if you call functions. sessionId: ${sessionId}`,
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
        return <p>Hey there! I'm not familiar with this repo just yet. Let me take a moment to analyze it. It typically takes around 1 to 5 minutes. Sit tight, and I'll be right back with some insights!😊</p>;
    } 
    if (error) return <p>Error: {error.message}</p>;

    return (
        <div>
            
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
