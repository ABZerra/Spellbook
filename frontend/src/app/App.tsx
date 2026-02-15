import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AppProvider } from './context/AppContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <div className="dark">
      <AppProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AppProvider>
    </div>
  );
}