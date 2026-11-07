import { useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '../components/AppLayout';

export function useLayoutSearch(): LayoutOutletContext {
  return useOutletContext<LayoutOutletContext>();
}
