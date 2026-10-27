import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({plugins:[vue()],server:{proxy:{'/api':'http://127.0.0.1:3199'},fs:{deny:['**/server/**','**/*.sqlite*','**/.env*']},watch:{ignored:['**/*.~tmp','**/server/data/**']}}})
