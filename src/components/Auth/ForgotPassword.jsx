import handleChangePassword from "./handleChangePassword"
import { MailCheck } from "lucide-react"

export default function ForgotPassword({setForgotPasswordData,forgotpasswordData,setIsLogin,setisPasswordChange,addToast}){
    return (
        <div className="mt-6 h-full space-y-4">
            <h1 className="text-3xl font-bold text-red-400 mb-2">Change Password</h1>
            <p className="text-gray-400 mb-5 text-sm">Enter you email address</p>

            <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400"><MailCheck /></span>
                <input
                    type="email"
                    placeholder="Email Address"
                    value={forgotpasswordData.email}
                    onChange={(e) => setForgotPasswordData({email: e.target.value})}
                    className="w-full bg-[#1b1b1b] text-white placeholder-gray-400 rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
                />
            </div>

            <button className="w-full bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl text-sm font-medium transition"
                onClick={async ()=>{
                    const data = await handleChangePassword(forgotpasswordData, addToast)
                    if(data) {
                        setIsLogin(true)
                        setisPasswordChange(false)
                    }
                }}
            >
                Send Mail
                <span>→</span>
            </button>
            </div>
    )
}