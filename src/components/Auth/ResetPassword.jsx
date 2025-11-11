import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RightPanel from './RightPanel';
import handleResetPassword from './handleResetPassword';
import { LockKeyhole, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword({addToast}) {
  const { token } = useParams()  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowComfirmPassword] = useState(false);
  const [password, setPassword] = useState({
    'password':'',
    'confirmpassword' :''
  });
  const navigate = useNavigate()

  const checkPasswordRequirements = (password) => ({
    length: password.length >= 8,
    numberOrSymbol: /[0-9!@#$%^&*]/.test(password),
    caseRequirement: /[a-z]/.test(password) && /[A-Z]/.test(password)
  });

  const requirements = checkPasswordRequirements(password.password);  

  return (
    <div className="min-h-screen bg-[#a9c1ff] flex items-center justify-center p-5">
      <div className="flex max-w-6xl w-full bg-[rgb(255,255,255,0.6)] rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex-1 p-16 relative overflow-hidden">
          <div className="absolute top-8 right-8 text-sm text-gray-600">
          </div>

          <div className="form-wrapper">
            <div className="mt-6">
                <h1 className="text-3xl h-full mb-5 font-bold text-gray-900">Reset Password</h1>

                <div className="mb-10">
                    <div className="flex items-center border-b-2 border-gray-400 focus-within:border-indigo-600 transition-colors rounded-xl px-4 py-2">
                    <span className="text-gray-400 mr-3 text-lg"><LockKeyhole /></span>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password.password}
                        onChange={(e) => setPassword({...password, password: e.target.value})}
                        className="flex-1 outline-none text-gray-800"
                    />
                    <span 
                        className="text-gray-600 cursor-pointer text-lg"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? <Eye/> : <EyeOff /> }
                    </span>
                    </div>
                    <div className="mt-3 pl-1">
                    <div className={`text-xs mb-1 flex items-center ${requirements.length ? 'text-green-500' : 'text-gray-400'}`}>
                        <span className="mr-2 font-bold">{requirements.length ? '✓' : '○'}</span>
                        Least 8 characters
                    </div>
                    <div className={`text-xs mb-1 flex items-center ${requirements.numberOrSymbol ? 'text-green-500' : 'text-gray-400'}`}>
                        <span className="mr-2 font-bold">{requirements.numberOrSymbol ? '✓' : '○'}</span>
                        Least one number (0-9) or a symbol
                    </div>
                    <div className={`text-xs mb-1 flex items-center ${requirements.caseRequirement ? 'text-green-500' : 'text-gray-400'}`}>
                        <span className="mr-2 font-bold">{requirements.caseRequirement ? '✓' : '○'}</span>
                        Lowercase (a-z) and uppercase (A-Z)
                    </div>
                    </div>
                </div>

                <div className="mb-10">
                    <div className="flex items-center border-b-2 border-gray-400 focus-within:border-indigo-600 transition-colors rounded-xl px-4 py-2">
                    <span className="text-gray-400 mr-3 text-lg"><LockKeyhole /></span>
                    <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-Type Password"
                        value={password.confirmpassword}
                        onChange={(e) => setPassword({...password, confirmpassword: e.target.value})}
                        className="flex-1 outline-none text-gray-800"
                    />
                    <span 
                        className="text-gray-600 cursor-pointer text-lg"
                        onClick={() => setShowComfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? <Eye/> : <EyeOff /> }
                    </span>
                    </div>
                    
                </div>

                <div className='flex gap-6'>
                <button className="bg-[#3a47b0] text-white px-6 py-3 rounded-full font-semibold flex items-center gap-3 mt-4 hover:scale-105 transition-transform cursor-pointer"
                    onClick={()=>handleResetPassword(password,requirements,addToast,token)}  
                    >
                    Reset Password
                    <span>→</span>
                </button>
                <button className="bg-[#3a47b0] text-white px-6 py-3 rounded-full font-semibold flex items-center gap-3 mt-4 hover:scale-105 transition-transform cursor-pointer" onClick={()=>navigate('/auth',{replace:true})}>Go to Log In page</button>
                </div>
                </div>
          </div>
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
