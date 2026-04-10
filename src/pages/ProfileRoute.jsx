import { useOutletContext } from 'react-router-dom';
import Profile from '../components/Profile';

export default function ProfileRoute() {
  const { session } = useOutletContext();
  return (
    <div className="student-page-wrap student-page-wrap--flush student-profile-route">
      <Profile session={session} embedded />
    </div>
  );
}
