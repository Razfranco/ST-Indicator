export type StudentStatus = 'active' | 'paused' | 'ended'

export type Student = {
  id: string
  created_at: string
  display_name: string
  phone: string | null
  status: StudentStatus
  notes: string | null
}

export type StudentInsert = Omit<Student, 'id' | 'created_at'> & Partial<Pick<Student, 'id' | 'created_at'>>
export type StudentUpdate = Partial<StudentInsert>

export type MentorAssignment = {
  id: string
  created_at: string
  student_id: string
  mentor_user_id: string
  active: boolean
  valid_from: string
  valid_to: string | null
}

export type MentorAssignmentInsert = Omit<MentorAssignment, 'id' | 'created_at'> &
  Partial<Pick<MentorAssignment, 'id' | 'created_at'>>
export type MentorAssignmentUpdate = Partial<MentorAssignmentInsert>

export type MeetingChannel = 'whatsapp' | 'google_meet' | 'other'
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export type MentorshipMeeting = {
  id: string
  created_at: string
  student_id: string
  mentor_user_id: string
  starts_at: string
  duration_minutes: number
  channel: MeetingChannel
  status: MeetingStatus
  topic: string | null
  notes: string | null
  consent_given: boolean
}

export type MentorshipMeetingInsert = Omit<MentorshipMeeting, 'id' | 'created_at'> &
  Partial<Pick<MentorshipMeeting, 'id' | 'created_at'>>
export type MentorshipMeetingUpdate = Partial<MentorshipMeetingInsert>
