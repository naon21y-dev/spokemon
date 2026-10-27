import vueMore from './vue-more.js'
import intellijMore from './intellij-more.js'
import sqlMore from './sql-more.js'
import javascriptMore from './javascript-more.js'
import pythonMore from './python-more.js'
import deeplearningMore from './deeplearning-more.js'
import gitMore from './git-more.js'
import vue from './vue.js'
import intellij from './intellij.js'
import sql from './sql.js'
import javascript from './javascript.js'
import python from './python.js'
import deeplearning from './deeplearning.js'
import git from './git.js'
export const subjects = [
 {id:'vue',name:'Vue.js',icon:'V',description:'반응성 · 컴포넌트 · 템플릿',source:'https://vuejs.org/guide/'},
 {id:'intellij',name:'IntelliJ IDEA',icon:'IJ',description:'IDE · 실행 · 디버깅 · 리팩터링',source:'https://www.jetbrains.com/help/idea/working-with-source-code.html'},
 {id:'sql',name:'데이터베이스(SQL)',icon:'DB',description:'조회 · 집계 · 관계 · 트랜잭션',source:'https://www.postgresql.org/docs/current/tutorial-sql.html'},
 {id:'javascript',name:'JavaScript',icon:'JS',description:'변수 · 배열 · 함수 · 비동기',source:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'},
 {id:'python',name:'Python',icon:'Py',description:'자료형 · 제어문 · 함수 · 예외',source:'https://docs.python.org/3/tutorial/'},
 {id:'deeplearning',name:'딥러닝',icon:'AI',description:'신경망 · 학습 · 검증 · 과적합',source:'https://www.tensorflow.org/tutorials/keras/overfit_and_underfit'},
 {id:'git',name:'Git·GitHub',icon:'Git',description:'커밋 · 브랜치 · 원격 · 협업',source:'https://git-scm.com/docs/gittutorial'}
]
export const questions = [...vue,...vueMore,...intellij,...intellijMore,...sql,...sqlMore,...javascript,...javascriptMore,...python,...pythonMore,...deeplearning,...deeplearningMore,...git,...gitMore]
export const questionMap = Object.fromEntries(questions.map(q=>[q.id,q]))
export const subjectMap = Object.fromEntries(subjects.map(s=>[s.id,s]))
export const typeNames = {all:'전체',multiple:'객관식',short:'주관식'}
