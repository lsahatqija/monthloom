import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
process.env.API_INTERNAL_URL = 'http://localhost:4000';

afterEach(cleanup);
