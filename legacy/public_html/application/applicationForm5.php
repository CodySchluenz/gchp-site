<?php
if (!isset($_SESSION))
{
session_start(); 
}

	
	
?>


<form action="#" method="post" name="appForm5">
		<div class="panelTable">
				<table>	
		<tr>
		<td><h2>PAY IT FORWARD REQUIREMENT</h2>
		</td>
		</tr>

		</tr>
		<td><p style="line-height:20px">To receive gifts from the Holiday Project we are requesting applicants give something of themselves to help others in their community. Below you will list things you have done to assist or befriend others in your community. Some examples are shoveling snow, giving ride to store, just calling a shut in to visit, visit the nursing home, volunteer to do things in your community etc. when you do the kind deeds, tell the person you are doing this as a part of the Holiday Project Pay Forward Program. Stating the program believes in caring and giving year round. <strong><h3>Helping family members and doing things for which you are reimbursed doesn't meet Pay Forward requirements.</h3></strong> Happy Giving!</p><br><br>
		<h5 style="text-align:center">Please list at least one good deed you have done to help another<br><textarea rows="3" cols="60" name="deedTXT"></textarea></h5></td>



	</table></div>
<div class="form_settings"><br><br>
<input class="inputBtn" type="submit" value="Back" name="back" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Cancel" name="cancel" onclick="show_confirm()" />&nbsp;&nbsp;&nbsp;
<input class="inputBtn" type="submit" value="Finish" name="appPt5" />
</div>
</form>