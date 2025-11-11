import { MailCheck, LockKeyhole, Eye, EyeOff} from 'lucide-react'
import handleLogIn from './handLogIn'
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";

export default function LoginForm({setLoginData, setShowLoginPassword, loginData, showLoginPassword, addToast, setisPasswordChange, setIsLogin}){

  return (
    <div className="mt-6 space-y-4">

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><MailCheck /></span>
          <input
            type="email"
            placeholder="Email Address"
            value={loginData.email}
            onChange={(e) => setLoginData({...loginData, email: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
      </div>

      <div className="relative">
          <span className="absolute left-3 top-3 text-gray-400"><LockKeyhole /></span>
          <input
            type={showLoginPassword ? "text" : "password"}
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
            className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
          />
          <span 
            className="absolute right-3 top-3 text-xs text-gray-400 cursor-pointer"
            onClick={() => setShowLoginPassword(!showLoginPassword)}
          >
            {showLoginPassword ? <Eye/> : <EyeOff /> }
          </span>
      </div>

      <div className="text-right mb-4">
        <button onClick={()=>{
          setisPasswordChange(true)
        }} className="text-red-500 text-sm hover:underline">Forgot Password?</button>
      </div>

      <button className="w-full bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl text-sm font-medium transition"
        onClick={()=>handleLogIn(loginData, addToast)}
      >
        Log In
        <span>→</span>
      </button>

      <div className="flex items-center my-6 text-gray-400 text-sm">
        <div className="flex-1 h-px bg-gray-400"></div>
        <span className="mx-4">Or LogIn with</span>
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