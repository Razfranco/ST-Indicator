import {useState} from 'react'
import {notificationRequest} from '../../lib/mentoringNotifications'
import {Button} from '../../components/ui/button'
import {inputClass} from '../../components/BusinessFormControls'
export type WeekException={student_id:string;week_start:string;reason:string;created_by:string;updated_at:string}
export function WeekExceptionControl({studentId,week,existing,onSaved}:{studentId:string;week:string;existing?:WeekException;onSaved:()=>void}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function save(){if(reason.trim().length<3){setError('יש לכתוב סיבה מדוע לא תתקיים פגישה השבוע.');return}setBusy(true);setError('');try{await notificationRequest({action:'week_exception',studentId,week,reason:reason.trim()});setOpen(false);onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="flex flex-col gap-2"><Button size="sm" variant="outline" onClick={()=>{setReason(existing?.reason??'');setError('');setOpen(true)}}>{existing?'עדכון הסיבה':'לא תתקיים פגישה השבוע'}</Button>{open&&<div className="flex flex-col gap-2 rounded-md border p-3"><label className="text-sm font-medium">סיבה — חובה<textarea className={inputClass} rows={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} /></label><p className="text-xs text-muted-foreground">הסימון חל רק על השבוע שנבחר ואינו מבטל פגישות שכבר נקבעו.</p>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button size="sm" disabled={busy||reason.trim().length<3} onClick={()=>void save()}>{busy?'שומר…':'שמירת הסיבה'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>סגירה</Button></div></div>}</div>
}
