import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import Spinner from './Spinner';

const PrivateRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <Spinner label="Checking your session…" />;

  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
