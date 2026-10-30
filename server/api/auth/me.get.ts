import { defineEventHandler } from 'h3'
import { requireStaff } from '../../auth/session'
export default defineEventHandler(event => requireStaff(event))
