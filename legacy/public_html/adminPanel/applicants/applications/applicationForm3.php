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

?><br> <br>
<table>
		<tr><th colspan="4" style="text-align:center"></th></tr>
		<tr><td align="right">Food share Amount:</td>
			<td colspan="2"><input type="text" size="10" name="foodAmt" value="<?php echo $info['fsAmount'] ?>" /></td>
		</tr><!-- //if re-added at a later date.//
		<tr><td align="right">Badger Care Amount:</td>
			<td colspan="2"><input type="text" size="10" name="badgerAmt" value="<?php echo $badgerAmt ?>" /></td>
		</tr>
		<tr><td align="right">Medical Amount:</td>
			<td colspan="2"><input type="text" size="10" name="medicalAmt" value="<?php echo $medAmt ?>" /></td>
		</tr> -->
		<tr><td align="right">Social Security Amount:</td>
			<td colspan="2"><input type="text" size="10" name="socialAmt" value="<?php echo $info['socAmount']; ?>" /></td>
		</tr>
		<tr><td align="right">SSI Amount:</td>
			<td colspan="2"><input type="text" size="10" name="ssiAmt" value="<?php echo $info['ssiAmount']; ?>" /></td>
		</tr>
		<tr><td align="right">W2 Amount:</td>
			<td colspan="2"><input type="text" size="10" name="w2Amt" value="<?php echo $info['w2Amount']; ?>" /></td>
		</tr>
		<tr><td align="right">Child Support Amount:</td>
			<td colspan="2"><input type="text" size="10" name="childAmt" value="<?php echo $info['csAmount']; ?>" /></td>
		</tr>
		<tr><td align="right">Other Income Amount:</td>
			<td colspan="2"><input type="text" size="10" name="otherAmt" value="<?php echo $info['omAmount']; ?>" /></td>
		</tr>
	</table>
	