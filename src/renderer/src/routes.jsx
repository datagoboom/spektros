// routes.jsx
import { useEffect, useLocation } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useHistory } from './contexts/HistoryContext'; 
import Layout from './components/Layout';

// Import your page components
import Analysis from './pages/Analysis';
import Injector from './pages/Injector';
import History from './pages/History';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { Navigate } from 'react-router-dom';

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <Navigate to="/analysis" replace />
            },
            {
                path: 'analysis',
                element: <Analysis />
            },
            {
                path: 'injector',
                element: <Injector />
            },
            {
                path: 'history',
                element: <History />
            },
            {
                path: 'settings',
                element: <Settings />
            },
            {
                path: '*',
                element: <NotFound />
            }
        ]
    }
]);

const AppRouter = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;