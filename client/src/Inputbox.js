import React, { useState, useEffect } from 'react';

function Inputbox({setQuestion}){
    const [localQuestion, setLocalQuestion] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setQuestion(localQuestion);
        setLocalQuestion("");
    };
    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    id="link"
                    name="link"
                    value={localQuestion}
                    placeholder='Enter your question'
                    onChange={(e) => { setLocalQuestion(e.target.value)}}
                />
                <br />
                <input type="submit" value="Submit" />
            </form>
        </div>
    );
}

export default Inputbox;