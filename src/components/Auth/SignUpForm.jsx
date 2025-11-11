import {ShieldUser, MailCheck, LockKeyhole, Eye, EyeOff} from 'lucide-react'
import handleSignUp from './handleSignUp'
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";

export default function SignUpForm({setShowSignupPassword, setSignupData, signupData, showSignupPassword, requirements, setShowComfirmPassword, showConfirmPassword, addToast, setIsLogin}){
  return (
    <div className="mt-6 space-y-4">

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><ShieldUser /></span>
          <input
            type="text"
            placeholder="Full Name"
            value={signupData.name}
            onChange={(e) => setSignupData({...signupData, name: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
      </div>

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><MailCheck /></span>
          <input
            type="email"
            placeholder="Email Address"
            value={signupData.email}
            onChange={(e) => setSignupData({...signupData, email: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
      </div>

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><LockKeyhole /></span>
          <input
            type={showSignupPassword ? "text" : "password"}
            placeholder="Password"
            value={signupData.password}
            onChange={(e) => setSignupData({...signupData, password: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
          <span 
            className="absolute right-3 top-3 text-xs text-gray-400 cursor-pointer"
            onClick={() => setShowSignupPassword(!showSignupPassword)}
          >
            {showSignupPassword ? <Eye/> : <EyeOff /> }
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

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><LockKeyhole /></span>
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Re-Type Password"
            value={signupData.confirmPassword}
            onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
          <span 
            className="absolute right-3 top-3 text-xs text-gray-400 cursor-pointer"
            onClick={() => setShowComfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <Eye/> : <EyeOff /> }
          </span>
      </div>

      <button className="w-full bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl text-sm font-medium transition"
        onClick={()=>handleSignUp(signupData, requirements,addToast,setIsLogin)}  
        >
        Sign Up
        <span>→</span>
      </button>

      <div className="flex items-center my-3 text-gray-400 text-sm">
        <div className="flex-1 h-px bg-gray-400"></div>
        <span className="mx-4">Or SignUp with</span>
        <div className="flex-1 h-px bg-gray-400"></div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          type="button"
          className="flex items-center justify-center bg-[#1b1b1b] rounded-full p-3 hover:bg-[#222]"
        >
          <FcGoogle className="text-xl" />
        </button>
        <button
          type="button"
          className="flex items-center justify-center bg-[#1b1b1b] rounded-full p-3 hover:bg-[#222]"
        >
          <FaFacebookF className="text-blue-500 text-xl" />
        </button>
      </div>
    </div>
  )
}