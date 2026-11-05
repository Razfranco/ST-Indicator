import { supabase } from './supabaseClient'
export type MissingRecording = { meeting_id:string; starts_at:string; student_name:string }
export async function notificationRequest<T>(body?:unknown):Promise<T>{
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Error('נדרשת התחברות')
 const r=await fetch('https://sharktradebom.com/api/mentoring-notifications',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store'})
 if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error==='notifications_disabled'?'שליחת Push כבויה בהגדרות הכלליות או בהעדפות החשבון.':'לא ניתן לעדכן התראות כרגע. נסה שוב.')}
 return r.json()
}
