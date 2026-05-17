import { useEffect, useState } from 'react';
import RightPanel from './RightPanel';
import LoaderComp from '../LoaderComp';
import { useNavigate, useParams } from 'react-router-dom';

export default function VerifyEmail({addToast}) {
    const [verified,setVerified] = useState(false)
    const { token } = useParams()
    const navigate = useNavigate()

    useEffect(()=>{
    (async function(){
      try{
        const response = await fetch(`http://localhost:8000/auth/verify_email/${token}`,{
          method:"PUT",
          headers:{
            "Content-Type":'application/JSON'
          }
        })
        const resData = await response.json()
        if(!response.ok){
          addToast(resData.detail,'error')
          return
        }
        setVerified(true)
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        return
      }
    })()},[])

    return (
        <div className="min-h-screen bg-[#a9c1ff] flex items-center justify-center p-5">
        <div className="flex max-w-6xl w-full bg-[rgb(255,255,255,0.6)] rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex-1 p-16 relative overflow-hidden">
            <div className="absolute top-8 right-8 text-sm text-gray-600">
            </div>

            <div className="form-wrapper">
                <div className="mt-6">
                    <h1 className="text-3xl h-full mb-5 font-bold text-gray-900">Verifying Email</h1>
                    {!verified ? <div className='mt-20'><LoaderComp size={100} strokeWidth={5} /></div>:
                    <div>
                    <p>Your email has been verified</p>
                    <button className="bg-[#3a47b0] text-white px-6 py-3 rounded-full font-semibold flex items-center gap-3 mt-4 hover:scale-105 transition-transform cursor-pointer" onClick={()=>navigate('/auth',{replace:true})}>Go to signin page</button>
                    </div> 
                    }
                </div>
            </div>
            </div>
            <RightPanel />
        </div>
        </div>
    );
}
