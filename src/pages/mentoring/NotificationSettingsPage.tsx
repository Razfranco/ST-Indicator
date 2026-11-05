import { NotificationPreferences } from './NotificationPreferences'
import { useEffect,useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { notificationRequest } from '../../lib/mentoringNotifications'
import { Button } from '../../components/ui/button'
import { Section } from '../../components/BusinessFormControls'
export function NotificationSettingsPage(){
 const {profile}=useAuth()
 const [key,setKey]=useState(''),[registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null),[subscription,setSubscription]=useState<PushSubscription|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const supported='serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
 useEffect(()=>{if(!profile?.approved)return;let live=true
 void notificationRequest<{publicKey:string}>().then(r=>{if(live)setKey(r.publicKey??'')}).catch(()=>{if(live)setMessage('לא ניתן לטעון הגדרות התראות')})
 if(supported)void navigator.serviceWorker.ready.then(async r=>{const sub=await r.pushManager.getSubscription();if(live){setRegistration(r);setSubscription(sub)}})
 return()=>{live=false}},[profile?.approved,supported])
 async function enable(){if(!registration||!key)return;setBusy(true);setMessage('')
 try{
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('יש לאפשר התראות בהגדרות המכשיר והאפליקציה.')
  const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0))
  const sub=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes})
  await notificationRequest({action:'subscribe',subscription:sub.toJSON()});setSubscription(sub);setMessage('התראות Push הופעלו במכשיר הזה לכל תחומי הפלטפורמה המורשים לחשבון שלך.')
 }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function action(kind:'test'|'unsubscribe'){if(!subscription)return;setBusy(true);setMessage('')
 try{await notificationRequest({action:kind,subscription:subscription.toJSON()});if(kind==='unsubscribe'){await subscription.unsubscribe();setSubscription(null)}setMessage(kind==='test'?'התראת הבדיקה נשלחה לשירות ה־Push.':'התראות Push במכשיר הזה כובו.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 if(!profile?.approved)return <p>נדרשת התחברות מאושרת.</p>
 return <div className="space-y-4"><h3 className="text-xl font-semibold">התראות</h3><p>הפעלת ההתראות במכשיר חלה אוטומטית על כל התחומים שאליהם יש לחשבון שלך גישה. מנטורים מקבלים התראות רק מהמנטורינג ומהתלמידים המשויכים להם. הרשאות החשבון נבדקות גם בזמן המשלוח.</p><NotificationPreferences /><Section title="התראות לנייד"><p>כאן מפעילים Push במכשיר הנוכחי ושולחים התראת בדיקה. התראות על מנויים, תקופות ניסיון, פגישות וסיכומים מוכנים יישלחו לפי ההרשאות וההעדפות שלך.</p><p className="text-sm text-muted-foreground">באייפון: פתח את הפלטפורמה מתוך האייקון במסך הבית ואז הפעל כאן התראות. ההפעלה נדרשת בנפרד בכל מכשיר. ההתראות מציגות את סוג האירוע ואת השם הרלוונטי, גם בתצוגה המקדימה במכשיר.</p>{!supported?<p>Push אינו זמין בחלון הזה. פתח את האפליקציה המותקנת במסך הבית.</p>:<div className="flex flex-wrap gap-2">{!subscription?<Button disabled={busy||!key||!registration} onClick={()=>void enable()}>הפעלת Push במכשיר הזה</Button>:<><Button disabled={busy} onClick={()=>void action('test')}>שליחת התראת בדיקה</Button><Button variant="outline" disabled={busy} onClick={()=>void action('unsubscribe')}>כיבוי Push במכשיר הזה</Button></>}</div>}<p role="status" className="text-sm">{message}</p></Section></div>
}
