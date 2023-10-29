import React, { useState, useEffect } from 'react';
import './Inputbox.css';

function Inputbox({setQuestion}){
    const [localQuestion, setLocalQuestion] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setQuestion(localQuestion);
        setLocalQuestion("");
    };
    return (
        // <div>
        //     <form onSubmit={handleSubmit}>
        //         <input
        //             type="text"
        //             id="link"
        //             name="link"
        //             value={localQuestion}
        //             placeholder='Enter your question'
        //             onChange={(e) => { setLocalQuestion(e.target.value)}}
        //         />
        //         <br />
        //         {/* <input type="submit" value="Submit" /> */}
        //     </form>
        // </div>
        <div className="chatgpt-input-container">
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    id="link"
                    name="link"
                    value={localQuestion}
                    placeholder='Send Message'
                    onChange={(e) => { setLocalQuestion(e.target.value) }}
                    className="chatgpt-input"
                />
            </form>
        </div>
    );
}

export default Inputbox;