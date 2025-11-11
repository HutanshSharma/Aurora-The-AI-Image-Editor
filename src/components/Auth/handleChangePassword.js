export default async function handleChangePassword(forgotpasswordData, addToast){
    if(forgotpasswordData.email === ''){
        addToast('Please enter you email address','error')
        return false
    }
    if(!isValidEmail(forgotpasswordData.email)){
        addToast("Invalid email address.", 'error')
        return false 
    }
    const returendValue = await (async function(){
      try{
        const reponse = await fetch("http://localhost:8000/auth/forgot_password",{
          method:"POST",
          body:JSON.stringify({"email":forgotpasswordData.email,
          }),
          headers:{
            "Content-Type":'application/JSON'
          }
        })

        const resData = await reponse.json()
        if(!reponse.ok){
          addToast(resData.detail,'error')
          return false
        }
        addToast("Check your email for instructions to securely update your password.","success")
        return true
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        return false
      }
    })()

    return returendValue
}

function isValidEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}