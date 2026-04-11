import { useOutletContext } from 'react-router-dom';
import Profile from '../components/Profile';
import { useStudentProfile } from '../context/StudentProfileContext';

export default function ProfileRoute() {
  const { session } = useOutletContext();
  const { refreshProfile } = useStudentProfile();
  return (
    <div className="student-page-wrap student-page-wrap--flush student-profile-route">
      <Profile session={session} embedded onAvatarUpdated={refreshProfile} />
    </div>
  );
}
