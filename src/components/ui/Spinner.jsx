import HashLoader from 'react-spinners/HashLoader';

export default function Spinner({ size = 40, color = '#f43f5e', className }) {
  return <HashLoader size={size} color={color} className={className} />;
}
