import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';


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
        // <div className="Home">
        //     <h1>GitGPT</h1>
        //     <form onSubmit={handleSubmit}>
        //         {/* <label htmlFor="link">Link:</label> */}
        //         <input
        //             type="text"
        //             id="link"
        //             name="link"
        //             value={link}
        //             placeholder='Type a Github Repository URL eg. https://github.com/cpacker/MemGPT'
        //             onChange={(e) => setLink(e.target.value)}
        //         />
        //         {/* <br /> */}
        //         {/* <input type="submit" value="Submit" /> */}
        //     </form>
        // </div>
        // <div className="Home">
        //     <h1>GitGPT</h1>
        //     <form onSubmit={handleSubmit} className="search-form">
        //         <span className="search-icon"></span>
        //         <input
        //             type="text"
        //             id="link"
        //             name="link"
        //             value={link}
        //             placeholder='Type a Github Repository URL eg. https://github.com/cpacker/MemGPT'
        //             onChange={(e) => setLink(e.target.value)}
        //         />
        //         <button type="submit" className="search-btn"></button>
        //     </form>
        // </div>
        <div className="Home">
            <h1>GitGPT</h1>
            <form onSubmit={handleSubmit} className="search-form">
                <div className="search-icon-wrapper">
                    <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M23.809 21.646l-6.205-6.205c1.167-1.605 1.857-3.579 1.857-5.711 0-5.365-4.365-9.73-9.731-9.73-5.365 0-9.73 4.365-9.73 9.73 0 5.366 4.365 9.73 9.73 9.73 2.034 0 3.923-.627 5.487-1.698l6.238 6.238 2.354-2.354zm-20.955-11.916c0-3.792 3.085-6.877 6.877-6.877s6.877 3.085 6.877 6.877-3.085 6.877-6.877 6.877c-3.793 0-6.877-3.085-6.877-6.877z" />
                    </svg>
                    <input
                        type="text"
                        id="link"
                        name="link"
                        value={link}
                        placeholder='Type a Github Repository URL eg. https://github.com/cpacker/MemGPT'
                        onChange={(e) => setLink(e.target.value)}
                    />
                </div>
                <button type="submit" className="search-btn"></button>
            </form>
        </div>


    )
}

export default Home;