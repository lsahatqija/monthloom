import { idSchema } from '@monthloom/contracts';
import { z } from 'zod';


export const fileIdParamsSchema = z.object({ id: idSchema });
