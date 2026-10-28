import {createRouter,createWebHashHistory} from 'vue-router'
import Workshop from '../views/WorkshopView.vue'
import Home from '../views/HomeView.vue'
import Hidden from '../views/HiddenGameView.vue'
import Card from '../views/CardGameView.vue'
import Quiz from '../views/QuizGameView.vue'
import Pet from '../views/PetGameView.vue'
import Account from '../views/AccountView.vue'
import Mistakes from '../views/MistakesView.vue'
import Student from '../views/StudentView.vue'
import Lesson from '../views/LessonView.vue'
import Admin from '../views/AdminView.vue'
import Mailbox from '../views/MailboxView.vue'
import {useArcade} from '../stores/arcade'
const router=createRouter({history:createWebHashHistory(),routes:[{path:'/workshop',component:Workshop},{path:'/',component:Home},{path:'/home',redirect:'/'},{path:'/account',component:Account},{path:'/hidden',component:Hidden},{path:'/cards',component:Card},{path:'/quiz',component:Quiz},{path:'/pet',component:Pet},{path:'/pet/mistakes',component:Mistakes},{path:'/pet/mailbox',component:Mailbox},{path:'/metro',redirect:'/'},{path:'/student',component:Student},{path:'/learn/:subject/:unit',component:Lesson},{path:'/admin',component:Admin},{path:'/:pathMatch(.*)*',redirect:'/'}],scrollBehavior:()=>({top:0})})
router.beforeEach(async to=>{const s=useArcade();await s.init();if(s.user?.role==='admin'&&to.path==='/')return '/admin';if(to.path==='/account')return;if(!s.user)return {path:'/account',query:{next:to.fullPath}};if(to.path==='/admin'&&s.user.role!=='admin')return '/student';if(!['/admin','/workshop'].includes(to.path)&&s.user.role==='admin')return '/admin'})
export default router
