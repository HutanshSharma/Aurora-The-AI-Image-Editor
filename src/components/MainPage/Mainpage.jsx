import { useNavigate } from "react-router-dom"
import { useUser } from "../../store/UserContext"
import handleVerifyEmail from "./handleVerifyEmail"

export default function MainPage({addToast}){
    const navigate = useNavigate()
    const {user} = useUser()

    function handleLogOut(){
        sessionStorage.clear()
        localStorage.removeItem('refresh_token')
        navigate('/auth',{replace:true})
    }

    return (
        <div className="flex justify-between px-8 py-4">
            <h1>Hello World</h1>
            <button onClick={handleLogOut} className="px-4 py-2 bg-amber-300 rounded-md cursor-pointer">Logout</button>
            {!!user ? (!Number(user.verified) ? <button onClick={()=>handleVerifyEmail(user,addToast)} className="px-4 py-2 bg-amber-300 rounded-md cursor-pointer">Verify Email</button>:null): null}
        </div>
    )
}