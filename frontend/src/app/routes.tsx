import { createBrowserRouter } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { CharactersPage } from './pages/CharactersPage';
import { PreparePage } from './pages/PreparePage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: PreparePage,
  },
  {
    path: '/prepare',
    Component: PreparePage,
  },
  {
    path: '/catalog',
    Component: CatalogPage,
  },
  {
    path: '/characters',
    Component: CharactersPage,
  },
], {
  basename: import.meta.env.BASE_URL,
});
