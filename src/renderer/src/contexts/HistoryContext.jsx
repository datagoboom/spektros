import React, { createContext, useContext, useState } from 'react';

const HistoryContext = createContext();

const HistoryProvider = ({ children }) => {
  const [browserHistory, setBrowserHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState('analysis');

  const addToBrowserHistory = (item) => {
    setBrowserHistory((prevHistory) => [...prevHistory, item]);
    setCurrentPage(item);
  };

  const clearBrowserHistory = () => { 
    setBrowserHistory([]);
    setCurrentPage('analysis');
  }

  const getBrowserHistory = () => {
    return browserHistory;
  }
  const getCurrentPage = () => {
    return currentPage;
  };

  return (
    <HistoryContext.Provider value={{ 
        currentPage,
        addToBrowserHistory,
        clearBrowserHistory,
        getBrowserHistory,
        }}>
      {children}
    </HistoryContext.Provider>
  );
};
const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
export { HistoryProvider, useHistory };