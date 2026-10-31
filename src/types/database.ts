export type RoomStatus = 'in_session' | 'recess' | 'adjourned';

export type ActionType = 'speech_aff' | 'speech_neg' | 'speech_author' | 'speech_sponsor' | 'question';

export interface Room {
  id: string;
  code: string;
  name: string;
  po_passcode: string;
  created_at: string;
  status: RoomStatus;
  current_legislation: string;
  active_speaker_id: string | null;
  active_speaker_name: string | null;
  global_recency_counter: number;
  global_question_counter: number;
}

export interface Representative {
  id: string;
  room_id: string;
  name: string;
  school: string;
  speeches_count: number;
  last_speech_order: number;
  questions_count: number;
  last_question_order: number;
  active: boolean;
  created_at?: string;
}

export interface RoundAction {
  id: string;
  room_id: string;
  representative_id: string;
  action_type: ActionType;
  speech_order_index: number;
  legislation: string;
  timestamp: string;
  representative_name?: string;
}

export interface TimerBroadcastPayload {
  room_code: string;
  seconds_left: number;
  duration: number;
  is_running: boolean;
  speaker_name: string | null;
  mode: 'speech' | 'dq' | 'question' | 'custom';
  timestamp: number;
}
