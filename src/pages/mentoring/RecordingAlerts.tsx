import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationRequest,type MissingRecording } from '../../lib/mentoringNotifications'
export function RecordingAlerts(){
 const [due,setDue]=useState<MissingRecording[]>([])
 useEffect(()=>{let live=true;async function refresh(){try{const r=await notificationRequest<{due:MissingRecording[]}>();if(live)setDue(r.due)}catch{ /* Keep the form usable if reminders are unavailable. */ }}
 void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},30000)
 return()=>{live=false;clearInterval(timer)}},[])
 if(!due.length)return null
 return <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><p className="font-semibold">{due.length} פגישות הסתיימו ללא הקלטה</p><ul className="mt-2 space-y-1">{due.map(m=><li key={m.meeting_id}><Link className="underline" to={'/mentoring/meetings/'+m.meeting_id+'/edit'}>{m.student_name} · {new Date(m.starts_at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})} — להעלאת הקלטה</Link></li>)}</ul></div>
}
