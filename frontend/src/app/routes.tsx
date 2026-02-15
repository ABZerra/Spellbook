import { createBrowserRouter } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { PreparePage } from './pages/PreparePage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: CatalogPage,
  },
  {
    path: '/prepare',
    Component: PreparePage,
  },
], {
  basename: import.meta.env.BASE_URL,
});
