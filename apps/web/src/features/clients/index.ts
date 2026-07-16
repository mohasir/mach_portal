export { ClientsPage } from './components/ClientsPage';
export { ClientDetailPage } from './components/detail/ClientDetailPage';
export {
  useClientsList,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useClient,
} from './hooks/useClients';
export type { Client, ClientDetail } from './types';
