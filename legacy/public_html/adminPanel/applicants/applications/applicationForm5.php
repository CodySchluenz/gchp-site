<?php
if (!isset($_SESSION))
{
session_start(); 
}
//               tests for valid login    needs to be on every page

if (!$_SESSION["valid_user"])
{
	// User not logged in, redirect to login page
	header("Location: ../login.php");

}
	
	
?>
<br><br>
	<table>
		<tr><td>* Good Deed:</td>
		<td rowspan="2"><textarea rows="6" cols="30" name="deedTXT"><?php echo $info['deedText']; ?></textarea></td>
		</tr>
		
		<tr><td colspan="4" class="whiteline"></td></tr>
		
		<tr>
			<td class="whiteline" colspan="4"></td>
		</tr>
	</table>
<br><br>
<input type='submit' name='act' value='Update' />
<input type='submit' name='act' value='Approve' />
<input type='submit' name='act' value='Deny' />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<input type='submit' name='act' value='Generate Household' />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<input type='submit' name='Exit' value='Exit' />
<input type='submit' name='act' value='DELETE Applicant' />
<br><br><br>