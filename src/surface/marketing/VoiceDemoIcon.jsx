import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  MessageCircle,
  Mic,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  mic: Mic,
  calendar: Calendar,
  clock: Clock,
  priority: Zap,
  check: CheckCircle2,
  tasks: ListTodo,
  bell: Bell,
  message: MessageCircle,
};

export function VoiceDemoIcon({ name, size = 18, className, strokeWidth = 2 }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
}
