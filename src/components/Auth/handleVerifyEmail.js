export default function handleVerifyEmail(user,addToast){
    (async function(){
        try{
            const reponse = await fetch("http://localhost:8000/auth/verify_email",{
            method:"POST",
            body:JSON.stringify({"email":user.email,
            }),
            headers:{
                "Content-Type":'application/JSON'
            }
            })

            const resData = await reponse.json()
            if(!reponse.ok){
            addToast(resData.detail,'error')
            return
            }
            addToast("A verification email has been sent to your registered email address.","success")
            return
        }
        catch(error){
            addToast('Something went wrong. Please try again later.','invalid')
            return
        }
    })()
}