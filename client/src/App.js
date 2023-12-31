
import React, { useState } from 'react';
// import { BrowserRouter as Router, Routes,Route, Link } from 'react-router-dom';
import { HashRouter as Router, Routes,Route, Link } from 'react-router-dom';
import Home from "./Home";
import AnalyzePage from './AnalyzePage';
import './App.css';

function App() {
  const [repoLink,setRepoLink] = useState("");
  
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home setRepoLink={setRepoLink}/>} />
          <Route
            path="/analyze"
            element={<AnalyzePage repoLink={repoLink} />}
          />
        </Routes>
      </div>
    </Router>
  );
  // return (
  //   <Router basename="/GitGPT">
  //     <div>
  //       <Routes>
  //         <Route path="/" element={<Home setRepoLink={setRepoLink} />} />
  //         <Route
  //           path="/analyze"
  //           element={<AnalyzePage repoLink={repoLink} />}
  //         />
  //       </Routes>
  //     </div>
  //   </Router>
  // );
}




export default App;
