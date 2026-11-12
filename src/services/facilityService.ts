import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type {
  Court,
  CourtScheduleBlock,
  Customer,
  Database,
  FacilityData,
  MaintenancePeriod,
  Payment,
  Reservation,
  Team
} from '../types/database';

const PAGE_SIZE = 500;

type Page<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

async function fetchAllPages<T>(loadPage: (from: number, to: number) => Promise<Page<T>>): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (data === null) throw new Error('Supabase devolvió una respuesta vacía sin indicar un error.');

    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function listCourts(client: SupabaseClient<Database>): Promise<Court[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('courts').select('*').order('name').range(from, to)
  );
}

export async function listCustomers(client: SupabaseClient<Database>): Promise<Customer[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('customers').select('*').order('full_name').range(from, to)
  );
}

export async function listTeams(client: SupabaseClient<Database>): Promise<Team[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('teams').select('*').order('name').range(from, to)
  );
}

export async function listReservations(client: SupabaseClient<Database>): Promise<Reservation[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('reservations').select('*').order('starts_at').range(from, to)
  );
}

export async function listPaymentsBetween(
  client: SupabaseClient<Database>,
  startAt: string,
  endAt: string
): Promise<Payment[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('payments').select('*')
      .gte('created_at', startAt).lte('created_at', endAt)
      .range(from, to)
  );
}

export async function listCourtScheduleBlocks(client: SupabaseClient<Database>): Promise<CourtScheduleBlock[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('court_schedule_blocks').select('*').range(from, to)
  );
}

export async function listMaintenanceBetween(
  client: SupabaseClient<Database>,
  startAt: string,
  endAt: string
): Promise<MaintenancePeriod[]> {
  return fetchAllPages(async (from, to) =>
    await client.from('maintenance_periods').select('*')
      .in('status', ['scheduled', 'in_progress', 'completed'])
      .gte('ends_at', startAt).lte('starts_at', endAt)
      .range(from, to)
  );
}

export async function loadFacilityData(client: SupabaseClient<Database>): Promise<FacilityData> {
  const [courts, customers, teams, reservations] = await Promise.all([
    listCourts(client),
    listCustomers(client),
    listTeams(client),
    listReservations(client)
  ]);

  return { courts, customers, teams, reservations };
}
