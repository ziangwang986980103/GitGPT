import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


function Home({setRepoLink}){
    const [link, setLink] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        const tempLink = link;
        setLink('');
        setRepoLink(tempLink);
        navigate('/analyze');
    };
    return (
        <div className="Home">
            <h1>Hello! Welcome to Understand Their Code.
                Paste the link of any GitHub repo below to get the analysis.</h1>
            <form onSubmit={handleSubmit}>
                <label htmlFor="link">Link:</label>
                <input
                    type="text"
                    id="link"
                    name="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                />
                <br />
                <input type="submit" value="Submit" />
            </form>
        </div>
    )
}

export default Home;