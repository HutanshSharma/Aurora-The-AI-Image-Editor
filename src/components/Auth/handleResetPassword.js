export default function handleResetPassword(password,requirements,addToast,token){
    if(password.password === '' || password.confirmpassword === ''){
    addToast('Required Fields are empty','error')
    return 
    }
    if(!requirements.length || !requirements.numberOrSymbol || !requirements.caseRequirement){
        addToast('Password requirements not met.','error')
        return 
    }
    if(password.password != password.confirmpassword){
        addToast('Password and confirm password do not match','error')
        return 
    }

    (async function(){
      try{
        const response = await fetch(`http://localhost:8000/auth/reset_password/${token}`,{
          method:"PUT",
          body:JSON.stringify({"password" :password.password}),
          headers:{
            "Content-Type":'application/JSON'
          }
        })

        const resData = await response.json()
        if(!response.ok){
          addToast(resData.detail,'error')
          return
        }
        addToast("Your password has been changed successfully.","success")
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        return
      }
    })()
}